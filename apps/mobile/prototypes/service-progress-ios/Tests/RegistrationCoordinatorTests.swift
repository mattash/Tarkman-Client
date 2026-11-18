import Foundation

@MainActor
private final class CoordinatorHTTP: ServiceRegistrationHTTP {
    enum Outcome { case success, failure, lostReceipt }
    var outcomes: [Outcome] = []
    var onSend: (() async -> Void)?
    var attempts: [(token: String, version: Int)] = []
    var serverToken: String?
    var serverVersion = 0
    var calls = 0
    func send(_ request: ServiceRegistrationRequest) async throws -> ServiceRegistrationResponse {
        calls += 1
        let body = try JSONSerialization.jsonObject(with: request.body!) as! [String: Any]
        let token = body["push_token"] as! String
        let version = body["token_version"] as! Int
        attempts.append((token, version))
        let action = outcomes.isEmpty ? .success : outcomes.removeFirst()
        let callback = onSend
        onSend = nil
        await callback?() // Deterministic suspension/reentrant callbacks; never network.
        if action == .failure { throw ServiceRegistrationFailure.transport }
        precondition(version == serverVersion + 1 || (version == serverVersion && token == serverToken))
        serverVersion = version
        serverToken = token
        let receipt: [String: Any] = ["id": String(request.path.split(separator: "/").last!),
            "token_version": version, "lease_expires_at": "2026-11-14T22:00:00Z"]
        return ServiceRegistrationResponse(status: 200, headers: ["Cache-Control": "no-store"],
            body: action == .lostReceipt ? Data("{}".utf8) : try JSONSerialization.data(withJSONObject: receipt))
    }
}

@main
@MainActor
private struct RegistrationCoordinatorTests {
    static var checks = 0
    static let clock = ISO8601DateFormatter().date(from: "2026-11-14T21:00:00Z")!
    static let identity = ServicePublicationIdentity(serviceID: 42, generation: "62eb2844-f523-4f19-a8b0-ab8ace413563")
    static func check(_ condition: Bool) { precondition(condition); checks += 1 }
    static func setup() throws -> (CoordinatorHTTP, ServiceRegistrationTransport, ServiceRegistrationFollow, ServiceRegistrationCoordinator) {
        let http = CoordinatorHTTP()
        let transport = ServiceRegistrationTransport(enabled: true, http: http, now: { clock })
        let follow = try transport.begin(identity: identity, activityID: "synthetic-activity",
            capability: String(repeating: "synthetic-only-", count: 4))
        return (http, transport, follow, ServiceRegistrationCoordinator(transport: transport, follow: follow))
    }
    static func main() async throws {
        // No second token event is required to recover the original registration.
        let (http, _, _, coordinator) = try setup()
        http.outcomes = [.failure, .success, .success]
        await coordinator.receive(token: "AABB")
        check(http.calls == 1 && coordinator.failure != nil && http.serverVersion == 0)
        check(coordinator.needsRetry && !coordinator.isReconciling)
        await coordinator.retry()
        check(http.calls == 2 && coordinator.failure == nil && http.serverVersion == 1)
        check(!coordinator.needsRetry && !coordinator.isReconciling)
        check(http.attempts[0].token == http.attempts[1].token && http.attempts[1].version == 1)
        await coordinator.receive(token: "ccdd")
        check(http.serverVersion == 2 && http.serverToken == "ccdd")
        let beforeNoop = http.calls
        await coordinator.retry()
        check(http.calls == beforeNoop)
        check(!String(reflecting: coordinator).contains("ccdd"))

        // Lost receipt: server committed v1; reconcile same candidate at v1,
        // then publish only ONE most recent queued token at v2.
        let (lostHTTP, _, _, lost) = try setup()
        lostHTTP.outcomes = [.lostReceipt, .success, .success]
        lostHTTP.onSend = {
            check(lost.isReconciling && lost.needsRetry)
            await lost.receive(token: "1122")
            await lost.receive(token: "3344")
            await lost.retry() // Must not issue duplicate I/O while suspended.
            check(lostHTTP.calls == 1)
        }
        await lost.receive(token: "eeff")
        check(lost.failure != nil && lostHTTP.serverVersion == 1 && lostHTTP.calls == 1)
        await lost.retry()
        check(lost.failure == nil && lostHTTP.calls == 3)
        check(lostHTTP.attempts.map(\.version) == [1, 1, 2])
        check(lostHTTP.attempts.map(\.token) == ["eeff", "eeff", "3344"])

        // Failed pre-acceptance candidate also remains ahead of a newer token.
        let (failedHTTP, _, _, failed) = try setup()
        failedHTTP.outcomes = [.failure, .success, .success]
        await failed.receive(token: "aabb")
        await failed.receive(token: "ccdd")
        check(failedHTTP.attempts.map(\.token) == ["aabb", "aabb", "ccdd"])
        check(failedHTTP.attempts.map(\.version) == [1, 1, 2] && failed.failure == nil)

        // Cancellation during await suppresses every queued publication. It does
        // not pretend an in-flight server commit or removal has been undone.
        let (cancelHTTP, _, _, cancelled) = try setup()
        cancelHTTP.onSend = {
            await cancelled.receive(token: "ccdd")
            cancelled.cancel()
            await cancelled.retry()
            await cancelled.receive(token: "eeff")
        }
        await cancelled.receive(token: "aabb")
        await cancelled.retry()
        await cancelled.receive(token: "1122")
        check(cancelHTTP.calls == 1 && cancelled.failure == nil)
        check(!cancelled.needsRetry && !cancelled.isReconciling)
        check(cancelHTTP.serverToken == "aabb")

        // A second token arrives during each send: each entry call is bounded
        // to two sends; retry explicitly drains the remaining retained candidate.
        let (boundedHTTP, _, _, bounded) = try setup()
        boundedHTTP.onSend = {
            await bounded.receive(token: "ccdd")
            boundedHTTP.onSend = { await bounded.receive(token: "eeff") }
        }
        await bounded.receive(token: "aabb")
        check(boundedHTTP.calls == 2 && boundedHTTP.serverToken == "ccdd")
        check(bounded.needsRetry && !bounded.isReconciling)
        await bounded.retry()
        check(boundedHTTP.calls == 3 && boundedHTTP.serverToken == "eeff")
        check(!bounded.needsRetry && !bounded.isReconciling)

        // An old immutable handle cannot publish into an equal-service NEW
        // generation, even if its coordinator was not cancelled by its owner.
        let (guardHTTP, transport, handle, _) = try setup()
        let wrongIdentity = ServicePublicationIdentity(serviceID: identity.serviceID,
            generation: "ad5c044b-62bb-4b31-a4c4-141c20882465")
        let stale = ServiceRegistrationFollow(id: handle.id, identity: wrongIdentity)
        let guarded = ServiceRegistrationCoordinator(transport: transport, follow: stale)
        await guarded.receive(token: "aabb")
        check(guardHTTP.calls == 0)
        if case .staleFollow? = guarded.failure { checks += 1 } else { preconditionFailure("Identity guard") }
        guarded.cancel()
        await guarded.retry()
        check(guardHTTP.calls == 0 && guarded.failure == nil)

        let (invalidHTTP, _, _, invalid) = try setup()
        await invalid.receive(token: "not-hex")
        check(invalidHTTP.calls == 0)
        await invalid.receive(token: "aabb")
        check(invalidHTTP.calls == 1 && invalid.failure == nil)
        print("RegistrationCoordinatorTests: \(checks) checks passed (synthetic async HTTP only)")
    }
}
