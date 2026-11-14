import Foundation

// Preparation only. Backend #553, 2053e7547ffbfacee8d8fe5c4bc205abfa91837c.
// No default URL/HTTP driver, token observation, ActivityKit or provider activation.
// Activation prerequisites: connect an explicitly consented app token stream; review
// admission/provisioning; validate receipts/leases; end the local Activity and remove
// the old follow before switching. Never reuse a generation after removal/expiry.
// MainActor serialization plus the sending gate protects mutation across suspension.
@MainActor
protocol ServiceRegistrationHTTP {
    func send(_ request: ServiceRegistrationRequest) async throws -> ServiceRegistrationResponse
}

struct ServiceRegistrationRequest: CustomStringConvertible, CustomDebugStringConvertible {
    let method: String
    let path: String
    // Sensitive boundary: drivers may consume these, never log/persist them.
    let headers: [String: String]
    let body: Data?
    var description: String { "ServiceRegistrationRequest(\(method), [redacted])" }
    var debugDescription: String { description }
}

struct ServiceRegistrationResponse: CustomStringConvertible, CustomDebugStringConvertible {
    let status: Int
    let headers: [String: String]
    let body: Data
    var description: String { "ServiceRegistrationResponse(\(status), [redacted])" }
    var debugDescription: String { description }
}

enum ServiceRegistrationFailure: Error {
    case disabled, invalidInput, staleFollow, removalRequired, busy
    case pendingReplacement, transport, rejected(Int), invalidReceipt
}

enum ServiceRegistrationRemoval: Equatable {
    case neverAttempted, acknowledged
}

struct ServiceRegistrationReceipt: Equatable {
    let id: UUID
    let tokenVersion: Int
    let leaseExpiresAt: Date
}

// A callback must retain this immutable handle, not look up the current follow.
struct ServiceRegistrationFollow: Hashable {
    let id: UUID
    let identity: ServicePublicationIdentity
}

@MainActor
final class ServiceRegistrationTransport: CustomStringConvertible, CustomDebugStringConvertible {
    private struct Follow {
        let handle: ServiceRegistrationFollow
        let activityID: String
        let secret: String
        var token: String?
        var version = 0
        var pending: String?
        var leaseExpiresAt: Date?
        var removing = false
        var attemptedPut = false // Monotonic fact; never infer from cleared pending/version.
    }
    private let enabled: Bool
    private let http: ServiceRegistrationHTTP?
    private let now: () -> Date
    private var follow: Follow?
    private var removed: [ServiceRegistrationFollow: ServiceRegistrationRemoval] = [:]
    private var usedIDs = Set<UUID>()
    private var usedGenerations = Set<String>()
    private var sending = false
    nonisolated var description: String { "ServiceRegistrationTransport([redacted], enabled: \(enabled))" }
    nonisolated var debugDescription: String { description }

    init(enabled: Bool = false, http: ServiceRegistrationHTTP? = nil,
         now: @escaping () -> Date = Date.init) {
        self.enabled = enabled
        self.http = http
        self.now = now
    }

    // Caller supplies a fresh, cryptographically random installation capability.
    // ASCII restriction prevents header injection; UUIDs are not capabilities.
    func begin(identity: ServicePublicationIdentity, activityID: String,
               capability: String, id: UUID = UUID()) throws -> ServiceRegistrationFollow {
        try gate()
        guard follow == nil else { throw ServiceRegistrationFailure.removalRequired }
        guard identity.serviceID > 0,
              UUID(uuidString: identity.generation)?.uuidString.lowercased() == identity.generation,
              (1...200).contains(activityID.utf8.count),
              (32...512).contains(capability.utf8.count),
              capability.utf8.allSatisfy({ (33...126).contains($0) }),
              !usedIDs.contains(id), !usedGenerations.contains(identity.generation) else {
            throw ServiceRegistrationFailure.invalidInput
        }
        let handle = ServiceRegistrationFollow(id: id, identity: identity)
        usedIDs.insert(id)
        usedGenerations.insert(identity.generation)
        follow = Follow(handle: handle, activityID: activityID, secret: capability)
        return handle
    }

    // Same token retries/renews the current version. A changed token uses exactly
    // version+1 in ONE PUT, never DELETE+PUT. Ambiguous failure pins that candidate
    // until its exact retry succeeds: a lost receipt must not skip/reuse versions.
    func register(_ handle: ServiceRegistrationFollow, token: String,
                  leaseSeconds: Int = 3600) async throws -> ServiceRegistrationReceipt {
        try gate()
        guard var state = follow, state.handle == handle, !state.removing else {
            throw ServiceRegistrationFailure.staleFollow
        }
        if let expiry = state.leaseExpiresAt, expiry <= now() { throw ServiceRegistrationFailure.staleFollow }
        let token = token.lowercased()
        guard (2...200).contains(token.utf8.count), token.utf8.count.isMultiple(of: 2),
              token.utf8.allSatisfy({ (48...57).contains($0) || (97...102).contains($0) }),
              (60...3600).contains(leaseSeconds) else { throw ServiceRegistrationFailure.invalidInput }
        if let pending = state.pending, pending != token { throw ServiceRegistrationFailure.pendingReplacement }
        let version = state.token == token ? state.version : state.version + 1
        guard (1...2_147_483_647).contains(version) else { throw ServiceRegistrationFailure.invalidInput }
        state.pending = token
        follow = state
        let object: [String: Any] = [
            "session_id": handle.identity.serviceID, "activity_id": state.activityID,
            "generation": handle.identity.generation, "push_token": token,
            "token_version": version, "consent_version": "public-lock-screen-v1",
            "lease_seconds": leaseSeconds
        ]
        let request = ServiceRegistrationRequest(method: "PUT", path: path(handle),
            headers: ["Content-Type": "application/json", "X-Service-Activity-Secret": state.secret],
            body: try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]))
        state.attemptedPut = true
        follow = state // Persist intent BEFORE the first suspension/HTTP boundary.
        let response = try await send(request)
        guard response.status == 200 else { throw ServiceRegistrationFailure.rejected(response.status) }
        let receipt = try validate(response, handle: handle, version: version, leaseSeconds: leaseSeconds)
        state.token = token
        state.version = version
        state.leaseExpiresAt = receipt.leaseExpiresAt
        state.pending = nil
        follow = state
        return receipt
    }

    // Local invalidation precedes I/O. Failed deletion can only retry deletion;
    // callbacks cannot register/rotate it, nor switch identity until acknowledged.
    @discardableResult
    func remove(_ handle: ServiceRegistrationFollow) async throws -> ServiceRegistrationRemoval {
        try gate()
        if let result = removed[handle] { return result }
        guard var state = follow, state.handle == handle else { throw ServiceRegistrationFailure.staleFollow }
        state.removing = true
        state.token = nil
        state.pending = nil
        follow = state
        if !state.attemptedPut {
            // Nothing could exist remotely. Invalidate identity locally; retain
            // used IDs/generations so late callbacks and re-follows cannot reuse it.
            removed[handle] = .neverAttempted
            follow = nil
            return .neverAttempted
        }
        let response = try await send(ServiceRegistrationRequest(method: "DELETE", path: path(handle),
            headers: ["X-Service-Activity-Secret": state.secret], body: nil))
        guard response.status == 204 else { throw ServiceRegistrationFailure.rejected(response.status) }
        guard noStore(response), response.body.isEmpty else { throw ServiceRegistrationFailure.invalidReceipt }
        removed[handle] = .acknowledged
        follow = nil
        return .acknowledged
    }

    private func gate() throws {
        guard enabled, http != nil else { throw ServiceRegistrationFailure.disabled }
        guard !sending else { throw ServiceRegistrationFailure.busy }
    }

    private func path(_ handle: ServiceRegistrationFollow) -> String {
        "/public/service_activity_registrations/\(handle.id.uuidString.lowercased())"
    }

    private func send(_ request: ServiceRegistrationRequest) async throws -> ServiceRegistrationResponse {
        sending = true
        defer { sending = false }
        do { return try await http!.send(request) }
        catch { throw ServiceRegistrationFailure.transport } // Never echo driver errors/body/token.
    }

    private func noStore(_ response: ServiceRegistrationResponse) -> Bool {
        response.headers.contains { key, value in
            key.lowercased() == "cache-control" && value.lowercased().split(separator: ",")
                .contains { $0.trimmingCharacters(in: .whitespaces) == "no-store" }
        }
    }

    private func validate(_ response: ServiceRegistrationResponse, handle: ServiceRegistrationFollow,
                          version: Int, leaseSeconds: Int) throws -> ServiceRegistrationReceipt {
        struct Wire: Decodable {
            let id: String
            let token_version: Int
            let lease_expires_at: String
        }
        guard noStore(response), response.body.count <= 4096,
              let object = try? JSONSerialization.jsonObject(with: response.body) as? [String: Any],
              Set(object.keys) == Set(["id", "token_version", "lease_expires_at"]),
              let wire = try? JSONDecoder().decode(Wire.self, from: response.body),
              wire.id == handle.id.uuidString.lowercased(), wire.token_version == version else {
            throw ServiceRegistrationFailure.invalidReceipt
        }
        let formatter = ISO8601DateFormatter()
        guard let expiry = formatter.date(from: wire.lease_expires_at),
              expiry > now(), expiry <= now().addingTimeInterval(Double(leaseSeconds)) else {
            throw ServiceRegistrationFailure.invalidReceipt
        }
        return ServiceRegistrationReceipt(id: handle.id, tokenVersion: version, leaseExpiresAt: expiry)
    }
}
