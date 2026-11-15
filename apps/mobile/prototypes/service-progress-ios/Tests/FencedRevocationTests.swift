import Foundation

// Synthetic Foundation-only tests: no Keychain, network, ActivityKit or provider.
// swiftc -swift-version 6 -warnings-as-errors -strict-concurrency=complete \
// Shared/ServicePublicationV1.swift Shared/ServiceRegistrationTransport.swift \
// Shared/ServiceExperimentJournal.swift Tests/FencedRevocationTests.swift -o /tmp/fenced-revocation-tests
@MainActor
private final class FencedMemoryStorage: ServiceExperimentSecretStorage {
    var bytes: Data?
    var failRemove = false
    func load() throws -> Data? { bytes }
    func saveIfAbsent(_ data: Data) throws {
        guard bytes == nil else { throw ServiceExperimentJournalFailure.storage }
        bytes = data
    }
    func removeIfMatching(_ data: Data) throws {
        guard !failRemove, bytes == data else { throw ServiceExperimentJournalFailure.storage }
        bytes = nil
    }
}

@MainActor
private final class FencedFakeHTTP: ServiceRegistrationHTTP {
    var requests: [ServiceRegistrationRequest] = []
    var response = ServiceRegistrationResponse(status: 404, headers: [:], body: Data())
    var loseReceipt = false
    var started: (() -> Void)?
    var suspend = false
    var continuation: CheckedContinuation<Void, Never>?
    func send(_ request: ServiceRegistrationRequest) async throws -> ServiceRegistrationResponse {
        requests.append(request)
        started?()
        if suspend { await withCheckedContinuation { continuation = $0 } }
        if loseReceipt { throw NSError(domain: "synthetic-secret-driver-error", code: 1) }
        return response
    }
}

@main
@MainActor
private struct FencedRevocationTests {
    static var checks = 0
    static let origin = URL(string: "https://synthetic.invalid:9443")!
    static let id = UUID(uuidString: "e54ad734-cbb0-417f-ae4d-696cb1dd1439")!
    static let nextID = UUID(uuidString: "e54ad734-cbb0-417f-ae4d-696cb1dd1440")!
    static let generation = "1afad734-cbb0-417f-ae4d-696cb1dd1439"
    static let capability = String(repeating: "synthetic-capability_", count: 3)
    static let activity = "synthetic-activity"
    static func check(_ condition: Bool) { precondition(condition); checks += 1 }
    static func rejected(_ work: () async throws -> Void) async {
        do { try await work(); preconditionFailure("Expected rejection") }
        catch let failure as ServiceExperimentJournalFailure {
            check(!String(reflecting: failure).contains(capability))
            check(!String(reflecting: failure).contains("synthetic-secret"))
        } catch { preconditionFailure("Unsanitized failure") }
    }
    static func stage(_ journal: ServiceExperimentJournal, id: UUID = id) throws -> ServiceExperimentRecoveryRecord {
        try journal.stage(origin: origin,
            identity: ServicePublicationIdentity(serviceID: 42, generation: generation),
            activityID: activity, capability: capability, registrationID: id, consented: true)
    }
    static func fixture(restored: Bool = false) throws -> (FencedMemoryStorage, ServiceExperimentJournal) {
        let memory = FencedMemoryStorage()
        let journal = try ServiceExperimentJournal(storage: memory, enabled: true)
        _ = try stage(journal)
        return (memory, restored ? try ServiceExperimentJournal(storage: memory, enabled: true) : journal)
    }
    static func object(id: UUID = id) -> [String: Any] {
        ["id": id.uuidString.lowercased(), "session_id": 42, "activity_id": activity,
         "generation": generation, "revoked": true]
    }
    static func receipt(_ object: [String: Any]? = nil, status: Int = 200,
                        headers: [String: String] = ["Cache-Control": "no-store"]) throws -> ServiceRegistrationResponse {
        ServiceRegistrationResponse(status: status, headers: headers,
            body: try JSONSerialization.data(withJSONObject: object ?? self.object(), options: [.sortedKeys]))
    }
    static func reconcile(_ journal: ServiceExperimentJournal, _ http: FencedFakeHTTP,
                          id: UUID = id, origin: URL = origin) async throws {
        try await journal.reconcileRevocation(registrationID: id, configuredOrigin: origin, http: http)
    }
    static func assertRequest(_ request: ServiceRegistrationRequest, id: UUID = id) throws {
        check(request.method == "POST")
        check(request.path == "/public/service_activity_registrations/\(id.uuidString.lowercased())/revoke")
        check(request.headers == ["Content-Type": "application/json", "X-Service-Activity-Secret": capability])
        let body = try JSONSerialization.jsonObject(with: request.body!) as! [String: Any]
        check(Set(body.keys) == Set(["session_id", "activity_id", "generation"]))
        check(body["session_id"] as? Int == 42 && body["activity_id"] as? String == activity && body["generation"] as? String == generation)
        check(!String(reflecting: request).contains(capability))
    }
    static func main() async throws {
        for restored in [false, true] {
            let (memory, journal) = try fixture(restored: restored)
            let http = FencedFakeHTTP()
            let bytes = memory.bytes
            check(http.requests.isEmpty)
            // Legacy missing-row DELETE is not an acknowledgement. Fenced POST is
            // reachable afterward at the journal level for fresh and restored items.
            await rejected {
                try await journal.retryDeletion(registrationID: id, configuredOrigin: origin, http: http)
            }
            check(http.requests.count == 1 && http.requests[0].method == "DELETE")
            check(memory.bytes == bytes && journal.pendingRevocation != nil)
            http.response = try receipt()
            try await reconcile(journal, http)
            try assertRequest(http.requests[1])
            check(memory.bytes == nil && journal.recoveryRecord == nil)
            let count = http.requests.count
            try await reconcile(journal, http)
            check(http.requests.count == count)

            // Stale completion cannot clear or POST for a newer record.
            let newer = try stage(journal, id: nextID)
            let newerBytes = memory.bytes
            try await reconcile(journal, http)
            await rejected { try await reconcile(journal, http, id: UUID()) }
            check(http.requests.count == count && memory.bytes == newerBytes && journal.recoveryRecord == newer)
        }

        let (memory, journal) = try fixture(restored: true)
        let http = FencedFakeHTTP()
        let bytes = memory.bytes
        for wrongOrigin in ["https://other.invalid:9443", "https://synthetic.invalid", "http://synthetic.invalid:9443", "https://synthetic.invalid:9443/path"] {
            await rejected { try await reconcile(journal, http, origin: URL(string: wrongOrigin)!) }
            check(memory.bytes == bytes && http.requests.isEmpty)
        }
        let disabled = try ServiceExperimentJournal(storage: memory)
        await rejected { try await reconcile(disabled, http) }
        check(http.requests.isEmpty && memory.bytes == bytes)

        // Lost receipt is ambiguous: retry identical immutable identity and capability.
        http.response = try receipt()
        http.loseReceipt = true
        await rejected { try await reconcile(journal, http) }
        check(memory.bytes == bytes && journal.pendingRevocation != nil)
        http.loseReceipt = false
        memory.failRemove = true
        await rejected { try await reconcile(journal, http) }
        check(memory.bytes == bytes && journal.pendingRevocation != nil)
        memory.failRemove = false
        try await reconcile(journal, http)
        check(memory.bytes == nil && http.requests.count == 3)
        for request in http.requests {
            try assertRequest(request)
            check(request.body == http.requests[0].body && request.headers == http.requests[0].headers)
        }

        // Every malformed/mismatched receipt retains the exact durable record.
        var invalid: [ServiceRegistrationResponse] = []
        for status in [201, 204, 403, 404, 409, 429, 500, 502, 503] {
            invalid.append(try receipt(status: status))
        }
        invalid.append(try receipt(headers: [:]))
        invalid.append(try receipt(headers: ["Cache-Control": "no-cache"]))
        for raw in ["", "{", "null", "[]", "true", String(repeating: " ", count: 4097)] {
            invalid.append(ServiceRegistrationResponse(status: 200, headers: ["Cache-Control": "no-store"], body: Data(raw.utf8)))
        }
        for key in object().keys.sorted() {
            var missing = object()
            missing.removeValue(forKey: key)
            invalid.append(try receipt(missing))
            var null = object()
            null[key] = NSNull()
            invalid.append(try receipt(null))
        }
        for (key, badValues) in [
            ("id", [nextID.uuidString.lowercased(), id.uuidString.uppercased(), "invalid", 42] as [Any]),
            ("session_id", [43, "42", true, 42.5] as [Any]),
            ("activity_id", ["other-activity", 42] as [Any]),
            ("generation", ["2afad734-cbb0-417f-ae4d-696cb1dd1439", generation.uppercased(), 42] as [Any]),
            ("revoked", [false, 1, 0, "true"] as [Any])
        ] {
            for bad in badValues {
                var wrong = object()
                wrong[key] = bad
                invalid.append(try receipt(wrong))
            }
        }
        var extra = object()
        extra["extra"] = "synthetic"
        invalid.append(try receipt(extra))
        for response in invalid {
            let (holdMemory, holdJournal) = try fixture()
            let held = holdMemory.bytes
            let fake = FencedFakeHTTP()
            fake.response = response
            await rejected { try await reconcile(holdJournal, fake) }
            check(holdMemory.bytes == held && holdJournal.pendingRevocation != nil)
            check(fake.requests.count == 1)
        }

        // Await serialization covers fenced and legacy methods and local abandonment.
        let (busyMemory, busyJournal) = try fixture()
        let busyHTTP = FencedFakeHTTP()
        busyHTTP.response = try receipt(headers: ["CACHE-CONTROL": "private, No-Store"])
        busyHTTP.suspend = true
        let busyBytes = busyMemory.bytes
        let task = Task { try await reconcile(busyJournal, busyHTTP) }
        await withCheckedContinuation { started in
            busyHTTP.started = {
                check(busyJournal.pendingRevocation != nil)
                started.resume()
            }
        }
        await rejected { try await reconcile(busyJournal, busyHTTP) }
        await rejected { try await busyJournal.retryDeletion(registrationID: id, configuredOrigin: origin, http: busyHTTP) }
        do {
            try busyJournal.completeNeverAttemptedRemoval(registrationID: id, proof: .neverAttempted)
            preconditionFailure("In-flight local abandonment must fail")
        } catch is ServiceExperimentJournalFailure { checks += 1 }
        do {
            _ = try stage(busyJournal, id: nextID)
            preconditionFailure("In-flight overwrite must fail")
        } catch is ServiceExperimentJournalFailure { checks += 1 }
        check(busyMemory.bytes == busyBytes && busyHTTP.requests.count == 1)
        busyHTTP.continuation!.resume()
        try await task.value
        check(busyMemory.bytes == nil)

        // Storage identity comparison protects against an independently replaced item.
        let (swapMemory, swapJournal) = try fixture()
        let swapHTTP = FencedFakeHTTP()
        swapHTTP.response = try receipt()
        let replacement = Data("different-synthetic-item".utf8)
        swapHTTP.started = { swapMemory.bytes = replacement }
        await rejected { try await reconcile(swapJournal, swapHTTP) }
        check(swapMemory.bytes == replacement && swapJournal.pendingRevocation != nil)
        print("FencedRevocationTests: \(checks) checks passed (synthetic storage + fake HTTP only)")
    }
}
