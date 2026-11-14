import Foundation

// Foundation integration only: synthetic Activity ID/token events, in-memory secret
// storage and fake HTTP. NOT APNs acceptance, ActivityKit or physical delivery proof.
@MainActor
private final class FlowStorage: ServiceExperimentSecretStorage {
    var bytes: Data?
    var events: [String] = []
    func load() throws -> Data? { bytes }
    func saveIfAbsent(_ data: Data) throws {
        precondition(bytes == nil)
        bytes = data
        events.append("stage")
    }
    func removeIfMatching(_ data: Data) throws {
        precondition(bytes == data)
        bytes = nil
        events.append("clear")
    }
}

@MainActor
private final class FlowPublicHTTP: ServicePublicSelectionHTTP {
    let origin: URL
    var urls: [URL] = []
    init(origin: URL) { self.origin = origin }
    func get(serviceID: Int, state: Bool) async throws -> ServicePublicSelectionResponse {
        // Exercise the actual URL policy without sending the prepared request.
        let policy = try ServicePublicSelectionURLSessionHTTP(baseURL: origin, enabled: true)
        urls.append(try policy.prepare(serviceID: serviceID, state: state).url!)
        // Actual anonymous endpoint envelope: revision/status in session; title
        // only in /s/:id.json. Civil date is intentionally not source freshness.
        var session: [String: Any] = ["id": serviceID, "status": "active", "revision": 9,
            "date": "2000-01-01", "cursor": NSNull()]
        if !state { session["liturgy"] = "Synthetic selected service" }
        return ServicePublicSelectionResponse(status: 200,
            headers: ["Date": "Sat, 14 Nov 2026 21:00:00 GMT", "Content-Type": "application/json; charset=utf-8"],
            body: try JSONSerialization.data(withJSONObject: ["session": session]))
    }
}

@MainActor
private final class FlowRegistrationHTTP: ServiceRegistrationHTTP {
    let storage: FlowStorage
    let origin: URL
    var failNextPut = true
    var deleteStatus = 204
    var puts: [(token: String, version: Int)] = []
    var deletes = 0
    var version = 0
    var token: String?
    init(storage: FlowStorage, origin: URL) { self.storage = storage; self.origin = origin }
    func send(_ request: ServiceRegistrationRequest) async throws -> ServiceRegistrationResponse {
        // A genuine persisted matching record must predate ANY registration I/O.
        let record = try JSONDecoder().decode(ServiceExperimentRecoveryRecord.self, from: storage.bytes!)
        precondition(request.path == "/public/service_activity_registrations/\(record.registrationID.uuidString.lowercased())")
        precondition(request.headers["X-Service-Activity-Secret"] == record.capability)
        let policy = try ServiceRegistrationURLSessionHTTP(baseURL: origin, enabled: true)
        let prepared = try policy.prepare(request)
        precondition(prepared.url?.host == origin.host)
        storage.events.append(request.method)
        if request.method == "DELETE" {
            deletes += 1
            precondition(request.body == nil)
            return ServiceRegistrationResponse(status: deleteStatus, headers: ["Cache-Control": "no-store"], body: Data())
        }
        let body = try JSONSerialization.jsonObject(with: request.body!) as! [String: Any]
        precondition(body["session_id"] as? Int == 77 && body["generation"] as? String == record.identity.generation)
        precondition(body["consent_version"] as? String == "public-lock-screen-v1")
        let next = body["token_version"] as! Int
        let candidate = body["push_token"] as! String
        puts.append((candidate, next))
        if failNextPut { failNextPut = false; throw ServiceRegistrationFailure.transport }
        precondition(next == version + 1 || (next == version && candidate == token))
        version = next; token = candidate
        return ServiceRegistrationResponse(status: 200, headers: ["Cache-Control": "no-store"],
            body: try JSONSerialization.data(withJSONObject: ["id": record.registrationID.uuidString.lowercased(),
                "token_version": version, "lease_expires_at": "2026-11-14T22:00:00Z"]))
    }
}

@main
@MainActor
private struct RemoteExperimentFlowTests {
    static var checks = 0
    static let now = ISO8601DateFormatter().date(from: "2026-11-14T21:00:00Z")!
    static let backend = URL(string: "https://backend.example.invalid")!
    static let reader = URL(string: "https://reader.example.invalid")!
    static func check(_ condition: Bool) { precondition(condition); checks += 1 }
    static func identity(_ generation: String) -> ServicePublicationIdentity {
        ServicePublicationIdentity(serviceID: 77, generation: generation, readerOrigin: reader.absoluteString)
    }
    static func stage(_ journal: ServiceExperimentJournal, identity: ServicePublicationIdentity) throws -> ServiceExperimentRecoveryRecord {
        try journal.stage(origin: backend, identity: identity, activityID: "synthetic-not-an-ActivityKit-id",
            capability: "synthetic-fresh-capability-" + identity.generation, consented: true)
    }
    static func main() async throws {
        let defaults = try ServiceRemoteExperimentConfiguration()
        let disabledStorage = FlowStorage()
        let disabledPublic = FlowPublicHTTP(origin: backend)
        let disabledHTTP = FlowRegistrationHTTP(storage: disabledStorage, origin: backend)
        do {
            _ = try await ServicePublicSelectionVerifier(http: disabledPublic, enabled: defaults.remoteEnabled,
                clock: { now }).verify(serviceID: 77)
            preconditionFailure("Default public read enabled")
        } catch ServicePublicSelectionFailure.disabled {}
        let disabledTransport = ServiceRegistrationTransport(enabled: defaults.remoteEnabled, http: disabledHTTP)
        do {
            _ = try disabledTransport.begin(identity: identity("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
                activityID: "synthetic", capability: String(repeating: "synthetic-", count: 5))
            preconditionFailure("Default registration enabled")
        } catch ServiceRegistrationFailure.disabled {}
        check(!defaults.remoteEnabled && defaults.developmentOrigin == nil && defaults.developmentReaderOrigin == nil)
        check(disabledPublic.urls.isEmpty && disabledHTTP.puts.isEmpty && disabledStorage.events.isEmpty)

        let config = try ServiceRemoteExperimentConfiguration(info: ["ServiceProgressRemoteEnabled": true,
            "ServiceProgressDevelopmentOrigin": backend.absoluteString,
            "ServiceProgressDevelopmentReaderOrigin": reader.absoluteString])
        let publicHTTP = FlowPublicHTTP(origin: config.developmentOrigin!)
        let selection = try await ServicePublicSelectionVerifier(http: publicHTTP, enabled: config.remoteEnabled,
            clock: { now }).verify(serviceID: 77)
        check(publicHTTP.urls.map(\.absoluteString) == [backend.absoluteString + "/s/77/state.json", backend.absoluteString + "/s/77.json"])
        let selectedIdentity = identity("62eb2844-f523-4f19-a8b0-ab8ace413563")
        check(selection.serviceID == 77 && selectedIdentity.readerOrigin == reader.absoluteString)
        let initial = try selection.publication(identity: selectedIdentity, now: now)
        let reused = try selection.publication(identity: selectedIdentity, now: now.addingTimeInterval(59))
        check(initial.sessionID == 77 && initial.generation == selectedIdentity.generation)
        check(initial.occurrenceID == nil && initial.ordinal == nil && initial.total == nil && initial.role == nil && initial.contentContext == nil)
        check(initial.updatedAt == now && reused.updatedAt == initial.updatedAt && reused.expiresAt == initial.expiresAt)
        do { _ = try selection.publication(identity: selectedIdentity, now: now.addingTimeInterval(60)); preconditionFailure("Renewed source window") }
        catch ServicePublicSelectionFailure.stale { checks += 1 }

        let storage = FlowStorage()
        let journal = try ServiceExperimentJournal(storage: storage, enabled: config.remoteEnabled, now: { now })
        let record = try stage(journal, identity: selectedIdentity)
        let http = FlowRegistrationHTTP(storage: storage, origin: backend)
        let transport = ServiceRegistrationTransport(enabled: config.remoteEnabled, http: http, now: { now })
        let follow = try transport.begin(identity: record.identity, activityID: record.activityID,
            capability: record.capability, id: record.registrationID)
        let coordinator = ServiceRegistrationCoordinator(transport: transport, follow: follow)
        check(storage.events == ["stage"] && http.puts.isEmpty)
        await coordinator.receive(token: "aabb")
        check(coordinator.needsRetry && coordinator.failure != nil && http.puts.count == 1)
        await coordinator.retry() // No second token event needed.
        check(!coordinator.needsRetry && coordinator.failure == nil)
        check(http.puts.map(\.version) == [1, 1] && http.puts.map(\.token) == ["aabb", "aabb"])
        await coordinator.receive(token: "ccdd")
        check(http.version == 2 && http.token == "ccdd" && initial.expiresAt == reused.expiresAt)
        try journal.requestRemoval(registrationID: record.registrationID)
        coordinator.cancel()
        let removal = try await transport.remove(follow)
        check(removal == .acknowledged && http.deletes == 1 && storage.bytes != nil)
        // Match the real caller's idempotent second DELETE: journal verifies its
        // own origin/exact durable item rather than accepting a fabricated receipt.
        try await journal.retryDeletion(registrationID: record.registrationID, configuredOrigin: backend, http: http)
        check(storage.bytes == nil && journal.recoveryRecord == nil && http.deletes == 2)
        check(storage.events == ["stage", "PUT", "PUT", "PUT", "DELETE", "DELETE", "clear"])
        await coordinator.receive(token: "eeff")
        check(http.puts.count == 3 && publicHTTP.urls.count == 2)

        // Genuine same-process no-PUT removal, not a made-up 204 or enum proof.
        let early = try stage(journal, identity: identity("ad5c044b-62bb-4b31-a4c4-141c20882465"))
        let earlyFollow = try transport.begin(identity: early.identity, activityID: early.activityID,
            capability: early.capability, id: early.registrationID)
        try journal.requestRemoval(registrationID: early.registrationID)
        let earlyOutcome = try await transport.remove(earlyFollow)
        check(earlyOutcome == .neverAttempted && http.deletes == 2 && http.puts.count == 3)
        try journal.completeNeverAttemptedRemoval(registrationID: early.registrationID, proof: earlyOutcome)
        let next = try stage(journal, identity: identity("727528ec-52b1-4921-927f-be91b4be8ff9"))
        let nextFollow = try transport.begin(identity: next.identity, activityID: next.activityID,
            capability: next.capability, id: next.registrationID)
        check(nextFollow.identity.serviceID == 77 && nextFollow.identity.generation != earlyFollow.identity.generation)
        let nextOutcome = try await transport.remove(nextFollow)
        try journal.completeNeverAttemptedRemoval(registrationID: next.registrationID, proof: nextOutcome)
        check(storage.bytes == nil && nextOutcome == .neverAttempted)

        // Restart after ambiguous PUT: loading is deletion-only, not restored
        // consent, selection, Activity, token observation or automatic GET/PUT.
        let pending = try stage(journal, identity: identity("d86f029c-801b-4d74-8dc0-b4c09406f651"))
        let uncertainFollow = try transport.begin(identity: pending.identity, activityID: pending.activityID,
            capability: pending.capability, id: pending.registrationID)
        let uncertain = ServiceRegistrationCoordinator(transport: transport, follow: uncertainFollow)
        http.failNextPut = true
        await uncertain.receive(token: "1122")
        uncertain.cancel()
        let saved = storage.bytes
        let beforeRestart = storage.events
        let restored = try ServiceExperimentJournal(storage: storage, enabled: true, now: { now })
        check(restored.pendingRevocation == pending && storage.events == beforeRestart && publicHTTP.urls.count == 2)
        do {
            _ = try restored.stage(origin: backend, identity: selectedIdentity, activityID: "synthetic",
                capability: pending.capability, consented: false)
            preconditionFailure("Restored consent")
        } catch ServiceExperimentJournalFailure.consentRequired { checks += 1 }
        http.deleteStatus = 404 // Missing OR disabled is unknown, not deletion proof.
        do { _ = try await transport.remove(uncertainFollow); preconditionFailure("404 acknowledged") }
        catch ServiceRegistrationFailure.rejected(404) { checks += 1 }
        do {
            try await restored.retryDeletion(registrationID: pending.registrationID, configuredOrigin: backend, http: http)
            preconditionFailure("Unknown 404 cleared journal")
        } catch ServiceExperimentJournalFailure.invalidDeletionReceipt { checks += 1 }
        check(storage.bytes == saved && restored.pendingRevocation == pending)
        do { _ = try stage(restored, identity: selectedIdentity); preconditionFailure("Recovery bypassed") }
        catch ServiceExperimentJournalFailure.pendingRecovery { checks += 1 }
        check(http.puts.count == 4 && publicHTTP.urls.count == 2)
        print("RemoteExperimentFlowTests: \(checks) checks passed (synthetic Foundation flow; no APNs/physical proof)")
    }
}
