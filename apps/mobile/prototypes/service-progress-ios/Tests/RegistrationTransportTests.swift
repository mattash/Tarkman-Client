import Foundation

// Standalone fake-only executable; no HTTP driver or Apple frameworks.
// swiftc Shared/ServicePublicationV1.swift Shared/ServiceRegistrationTransport.swift \
//   Tests/RegistrationTransportTests.swift -o /tmp/registration-transport-tests
private final class FakeHTTP: ServiceRegistrationHTTP {
    var requests: [ServiceRegistrationRequest] = []
    var status = 200
    var fail = false
    var receiptOverride: Data?
    var headers = ["Cache-Control": "no-store"]
    var onSend: (() async -> Void)?
    // Deterministic backend-like consecutive-version/tombstone state.
    var version = 0
    var token: String?
    var revoked = false
    let expiry = "2026-11-14T22:00:00Z"
    func send(_ request: ServiceRegistrationRequest) async throws -> ServiceRegistrationResponse {
        requests.append(request)
        await onSend?()
        if fail { throw NSError(domain: "synthetic-secret-and-token-must-not-escape", code: 1) }
        if status != 200 { return ServiceRegistrationResponse(status: status, headers: headers, body: Data("untrusted-secret".utf8)) }
        if request.method == "DELETE" {
            revoked = true
            token = nil
            return ServiceRegistrationResponse(status: 204, headers: headers, body: Data())
        }
        let body = try JSONSerialization.jsonObject(with: request.body!) as! [String: Any]
        let next = body["token_version"] as! Int
        let candidate = body["push_token"] as! String
        if revoked || !(next == version + 1 || (next == version && candidate == token)) {
            return ServiceRegistrationResponse(status: 409, headers: headers, body: Data())
        }
        version = next
        token = candidate
        let receipt: [String: Any] = ["id": String(request.path.split(separator: "/").last!),
                                    "token_version": version, "lease_expires_at": expiry]
        return ServiceRegistrationResponse(status: 200, headers: headers,
            body: try receiptOverride ?? JSONSerialization.data(withJSONObject: receipt))
    }
}

@main
@MainActor
private struct RegistrationTransportTests {
    static let capability = String(repeating: "synthetic-capability-", count: 3)
    static let identity = ServicePublicationIdentity(serviceID: 42,
        generation: "62eb2844-f523-4f19-a8b0-ab8ace413563")
    static let id = UUID(uuidString: "e54ad734-cbb0-417f-ae4d-696cb1dd1439")!
    static let clock = ISO8601DateFormatter().date(from: "2026-11-14T21:00:00Z")!
    static var checks = 0
    static func check(_ value: Bool, _ label: String) {
        precondition(value, label)
        checks += 1
    }
    static func fails(_ expected: ServiceRegistrationFailure, _ block: () async throws -> Void) async {
        do { try await block(); preconditionFailure("Expected safe failure") }
        catch let actual as ServiceRegistrationFailure {
            check(String(describing: actual) == String(describing: expected), "Failure category")
        } catch { preconditionFailure("Unexpected unredacted failure") }
    }
    static func setup() throws -> (FakeHTTP, ServiceRegistrationTransport, ServiceRegistrationFollow) {
        let fake = FakeHTTP()
        let adapter = ServiceRegistrationTransport(enabled: true, http: fake, now: { clock })
        let handle = try adapter.begin(identity: identity, activityID: "synthetic-activity", capability: capability, id: id)
        return (fake, adapter, handle)
    }
    static func main() async throws {
        let disabledHTTP = FakeHTTP()
        let disabled = ServiceRegistrationTransport(http: disabledHTTP)
        await fails(.disabled) { _ = try disabled.begin(identity: identity, activityID: "a", capability: capability) }
        check(disabledHTTP.requests.isEmpty, "Default off")
        await fails(.disabled) {
            _ = try ServiceRegistrationTransport(enabled: true).begin(identity: identity, activityID: "a", capability: capability)
        }
        let (fake, adapter, handle) = try setup()
        let first = try await adapter.register(handle, token: "AABB")
        check(first.tokenVersion == 1 && first.id == id, "Validated receipt")
        let request = fake.requests[0]
        check(request.path == "/public/service_activity_registrations/\(id.uuidString.lowercased())", "Exact route")
        check(request.method == "PUT" && request.headers == ["Content-Type": "application/json", "X-Service-Activity-Secret": capability], "Capability boundary, no account auth")
        let body = try JSONSerialization.jsonObject(with: request.body!) as! [String: Any]
        check(Set(body.keys) == Set(["session_id", "activity_id", "generation", "push_token", "token_version", "consent_version", "lease_seconds"]), "Exact seven keys")
        check(body["session_id"] as? Int == 42 && body["generation"] as? String == identity.generation && body["activity_id"] as? String == "synthetic-activity", "Identity binding")
        check(body["push_token"] as? String == "aabb" && body["consent_version"] as? String == "public-lock-screen-v1" && body["lease_seconds"] as? Int == 3600, "Exact values")
        check(try await adapter.register(handle, token: "aabb").tokenVersion == 1, "Idempotent PUT")
        check(try await adapter.register(handle, token: "ccdd").tokenVersion == 2, "Atomic replacement")
        check(fake.requests.allSatisfy { $0.method == "PUT" } && fake.token == "ccdd", "No delete gap")
        check(!String(reflecting: request).contains(capability) && !String(reflecting: request).contains("aabb"), "Request debug redacted")
        check(!String(reflecting: adapter).contains(capability), "Adapter debug redacted")
        let secretResponse = ServiceRegistrationResponse(status: 403, headers: [:], body: Data(capability.utf8))
        check(!String(reflecting: secretResponse).contains(capability), "Response debug redacted")
        fake.fail = true
        await fails(.transport) { _ = try await adapter.register(handle, token: "eeff") }
        await fails(.pendingReplacement) { _ = try await adapter.register(handle, token: "1122") }
        fake.fail = false
        check(try await adapter.register(handle, token: "eeff").tokenVersion == 3, "Exact retry after uncertain outcome")
        // Simulate server acceptance with a lost/malformed receipt, then exact retry.
        fake.receiptOverride = Data("{}".utf8)
        await fails(.invalidReceipt) { _ = try await adapter.register(handle, token: "1234") }
        check(fake.version == 4, "Server committed despite lost receipt")
        fake.receiptOverride = nil
        check(try await adapter.register(handle, token: "1234").tokenVersion == 4, "No skipped version")
        for badToken in ["", "abc", "zz", String(repeating: "a", count: 202)] {
            await fails(.invalidInput) { _ = try await adapter.register(handle, token: badToken) }
        }
        for lease in [59, 3601] {
            await fails(.invalidInput) { _ = try await adapter.register(handle, token: "1234", leaseSeconds: lease) }
        }
        fake.onSend = {
            await fails(.busy) { _ = try await adapter.remove(handle) }
        }
        _ = try await adapter.register(handle, token: "1234")
        fake.onSend = nil
        fake.fail = true
        await fails(.transport) { _ = try await adapter.remove(handle) }
        await fails(.staleFollow) { _ = try await adapter.register(handle, token: "5678") }
        await fails(.removalRequired) { _ = try adapter.begin(identity: identity, activityID: "a", capability: capability) }
        fake.fail = false
        try await adapter.remove(handle)
        check(fake.requests.last!.method == "DELETE" && fake.requests.last!.body == nil && fake.requests.last!.headers == ["X-Service-Activity-Secret": capability], "DELETE no body/query")
        await fails(.invalidInput) { _ = try adapter.begin(identity: identity, activityID: "a", capability: capability) }
        let nextIdentity = ServicePublicationIdentity(serviceID: 43, generation: "ad5c044b-62bb-4b31-a4c4-141c20882465")
        let next = try adapter.begin(identity: nextIdentity, activityID: "next", capability: capability)
        let count = fake.requests.count
        await fails(.staleFollow) { _ = try await adapter.register(handle, token: "5678") }
        try await adapter.remove(handle) // Idempotent old removal is a no-op, never removes next.
        check(fake.requests.count == count && next.identity.serviceID == 43, "Old callbacks cannot touch switched session")
        // Every public backend rejection remains a safe status, not echoed JSON.
        for status in [400, 403, 404, 409, 422, 429, 500] {
            let (http, transport, follow) = try setup()
            http.status = status
            await fails(.rejected(status)) { _ = try await transport.register(follow, token: "aabb") }
        }
        for receipt in [
            String(repeating: " ", count: 4097),
            "{}",
            "{\"id\":\"00000000-0000-0000-0000-000000000000\",\"token_version\":1,\"lease_expires_at\":\"2026-11-14T22:00:00Z\"}",
            "{\"id\":\"\(id.uuidString.lowercased())\",\"token_version\":2,\"lease_expires_at\":\"2026-11-14T22:00:00Z\"}",
            "{\"id\":\"\(id.uuidString.lowercased())\",\"token_version\":1,\"lease_expires_at\":\"2026-11-14T21:00:00Z\"}",
            "{\"id\":\"\(id.uuidString.lowercased())\",\"token_version\":1,\"lease_expires_at\":\"2026-11-15T22:00:00Z\"}",
            "{\"id\":\"\(id.uuidString.lowercased())\",\"token_version\":1,\"lease_expires_at\":\"2026-11-14T22:00:00Z\",\"push_token\":\"aabb\"}"
        ] {
            let (http, transport, follow) = try setup()
            http.receiptOverride = Data(receipt.utf8)
            await fails(.invalidReceipt) { _ = try await transport.register(follow, token: "aabb") }
        }
        let (noStore, strict, strictHandle) = try setup()
        noStore.headers = [:]
        await fails(.invalidReceipt) { _ = try await strict.register(strictHandle, token: "aabb") }
        for badCapability in ["short", String(repeating: "x", count: 513), capability + "\r\nInjected: bad"] {
            let fresh = ServiceRegistrationTransport(enabled: true, http: FakeHTTP())
            await fails(.invalidInput) { _ = try fresh.begin(identity: identity, activityID: "a", capability: badCapability) }
        }
        var mutableClock = clock
        let expiryHTTP = FakeHTTP()
        let expiring = ServiceRegistrationTransport(enabled: true, http: expiryHTTP, now: { mutableClock })
        let expiringHandle = try expiring.begin(identity: identity, activityID: "a", capability: capability)
        _ = try await expiring.register(expiringHandle, token: "aabb")
        mutableClock = clock.addingTimeInterval(3600)
        await fails(.staleFollow) { _ = try await expiring.register(expiringHandle, token: "ccdd") }
        check(expiryHTTP.requests.count == 1, "Expired callbacks never renew freshness")
        try await expiring.remove(expiringHandle)
        let deletes = expiryHTTP.requests.count
        try await expiring.remove(expiringHandle)
        check(expiryHTTP.requests.count == deletes, "Idempotent removal")
        // A local follow before ANY PUT must not call backend DELETE (unknown IDs return 404).
        let (untouchedHTTP, untouched, untouchedHandle) = try setup()
        untouchedHTTP.status = 404
        let localRemoval = try await untouched.remove(untouchedHandle)
        check(localRemoval == .neverAttempted && untouchedHTTP.requests.isEmpty, "Never-attempted removal is local")
        await fails(.staleFollow) { _ = try await untouched.register(untouchedHandle, token: "aabb") }
        await fails(.invalidInput) { _ = try untouched.begin(identity: identity, activityID: "a", capability: capability) }
        await fails(.invalidInput) {
            _ = try untouched.begin(identity: nextIdentity, activityID: "a", capability: capability, id: untouchedHandle.id)
        }
        _ = try untouched.begin(identity: nextIdentity, activityID: "fresh", capability: capability)
        check(try await untouched.remove(untouchedHandle) == .neverAttempted && untouchedHTTP.requests.isEmpty,
              "Repeated old local removal never touches fresh follow")

        // First PUT in flight cannot be classified as never attempted.
        let (firstHTTP, firstTransport, firstHandle) = try setup()
        firstHTTP.onSend = {
            await fails(.busy) { _ = try await firstTransport.remove(firstHandle) }
        }
        _ = try await firstTransport.register(firstHandle, token: "aabb")
        firstHTTP.onSend = nil
        check(try await firstTransport.remove(firstHandle) == .acknowledged, "Attempted registration needs remote acknowledgement")
        check(firstHTTP.requests.map(\.method) == ["PUT", "DELETE"], "First-attempt in-flight safety")

        // Clearing pending during DELETE never erases the monotonic attempted fact.
        // Test both a pre-receipt transport failure and an accepted PUT with lost receipt.
        for committed in [false, true] {
            let (ambiguousHTTP, ambiguous, ambiguousHandle) = try setup()
            if committed { ambiguousHTTP.receiptOverride = Data("{}".utf8) }
            else { ambiguousHTTP.fail = true }
            await fails(committed ? .invalidReceipt : .transport) {
                _ = try await ambiguous.register(ambiguousHandle, token: "aabb")
            }
            ambiguousHTTP.fail = false
            ambiguousHTTP.receiptOverride = nil
            ambiguousHTTP.status = 404
            await fails(.rejected(404)) { _ = try await ambiguous.remove(ambiguousHandle) }
            await fails(.rejected(404)) { _ = try await ambiguous.remove(ambiguousHandle) }
            check(ambiguousHTTP.requests.map(\.method) == ["PUT", "DELETE", "DELETE"],
                  "Ambiguous version0/pending-cleared removal still retries remotely")
            await fails(.removalRequired) {
                _ = try ambiguous.begin(identity: nextIdentity, activityID: "fresh", capability: capability)
            }
            ambiguousHTTP.status = 200
            check(try await ambiguous.remove(ambiguousHandle) == .acknowledged, "Ambiguous removal requires explicit204")
            _ = try ambiguous.begin(identity: nextIdentity, activityID: "fresh", capability: capability)
        }
        print("RegistrationTransportTests: \(checks) checks passed (synthetic HTTP only)")
    }
}
