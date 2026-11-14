import Foundation

// Foundation-only deterministic executable. Never imports or instantiates Keychain,
// URLSession, ActivityKit, real service data, credentials or a push provider.
// swiftc -swift-version 6 -warnings-as-errors -strict-concurrency=complete \
// Shared/ServicePublicationV1.swift Shared/ServiceRegistrationTransport.swift \
// Shared/ServiceExperimentJournal.swift Tests/ExperimentJournalTests.swift -o /tmp/experiment-journal-tests
@MainActor
private final class MemorySecrets: ServiceExperimentSecretStorage {
    var bytes: Data?
    var failSave = false
    var failRemove = false
    var reads = 0
    func load() throws -> Data? { reads += 1; return bytes }
    func saveIfAbsent(_ data: Data) throws {
        guard !failSave, bytes == nil else { throw ServiceExperimentJournalFailure.storage }
        bytes = data
    }
    func removeIfMatching(_ data: Data) throws {
        guard !failRemove, bytes == data else { throw ServiceExperimentJournalFailure.storage }
        bytes = nil
    }
}

@MainActor
private final class FakeDeletionHTTP: ServiceRegistrationHTTP {
    var requests: [ServiceRegistrationRequest] = []
    var fail = false
    var response = ServiceRegistrationResponse(status: 204, headers: ["Cache-Control": "no-store"], body: Data())
    var onSend: (() -> Void)?
    var continuation: CheckedContinuation<Void, Never>?
    var suspend = false
    func send(_ request: ServiceRegistrationRequest) async throws -> ServiceRegistrationResponse {
        requests.append(request)
        onSend?()
        if suspend { await withCheckedContinuation { continuation = $0 } }
        if fail { throw NSError(domain: "synthetic-secret-must-not-escape", code: 1) }
        return response
    }
}

@main
@MainActor
private struct ExperimentJournalTests {
    static var checks = 0
    static let origin = URL(string: "https://synthetic.invalid:9443")!
    static let capability = String(repeating: "synthetic_capability-", count: 3)
    static let id = UUID(uuidString: "e54ad734-cbb0-417f-ae4d-696cb1dd1439")!
    static let identity = ServicePublicationIdentity(serviceID: 42, generation: "1afad734-cbb0-417f-ae4d-696cb1dd1439")
    static let clock = Date(timeIntervalSinceReferenceDate: 1000)
    static func check(_ value: Bool) { precondition(value); checks += 1 }
    static func rejects(_ work: () throws -> Void) {
        do { try work(); preconditionFailure("Expected rejection") }
        catch let failure as ServiceExperimentJournalFailure {
            check(!String(reflecting: failure).contains(capability))
        } catch { preconditionFailure("Unsanitized failure") }
    }
    static func rejectsAsync(_ work: () async throws -> Void) async {
        do { try await work(); preconditionFailure("Expected rejection") }
        catch let failure as ServiceExperimentJournalFailure {
            check(!String(reflecting: failure).contains(capability))
            check(!String(reflecting: failure).contains("synthetic-secret"))
        } catch { preconditionFailure("Unsanitized failure") }
    }
    static func stage(_ journal: ServiceExperimentJournal, id: UUID = id) throws -> ServiceExperimentRecoveryRecord {
        try journal.stage(origin: origin, identity: identity, activityID: "synthetic-activity",
                          capability: capability, registrationID: id, consented: true)
    }
    static func deletion(_ journal: ServiceExperimentJournal, _ http: FakeDeletionHTTP,
                         id: UUID = id, origin: URL = origin) async throws {
        try await journal.retryDeletion(registrationID: id, configuredOrigin: origin, http: http)
    }
    static func main() async throws {
        let memory = MemorySecrets()
        let disabled = try ServiceExperimentJournal(storage: memory)
        rejects { _ = try stage(disabled) }
        check(memory.bytes == nil)
        let journal = try ServiceExperimentJournal(storage: memory, enabled: true, now: { clock })
        rejects {
            _ = try journal.stage(origin: origin, identity: identity, activityID: "synthetic",
                                  capability: capability, consented: false)
        }
        memory.failSave = true
        rejects { _ = try stage(journal) }
        check(journal.recoveryRecord == nil && memory.bytes == nil)
        memory.failSave = false
        let record = try stage(journal)
        check(record.createdAt == clock && record.identity == identity)
        let durable = memory.bytes!
        check(journal.recoveryRecord == record && journal.pendingRevocation == nil)
        check(!String(reflecting: record).contains(capability))
        check(!String(reflecting: journal).contains(capability))
        let object = try JSONSerialization.jsonObject(with: durable) as! [String: Any]
        check(Set(object.keys) == Set(["origin", "registrationID", "identity", "activityID", "capability", "createdAt"]))
        rejects { _ = try stage(journal, id: UUID()) }
        check(memory.bytes == durable)

        // Relaunch is local-only, consent is not restored, and no HTTP exists in init.
        let restart = try ServiceExperimentJournal(storage: memory, enabled: true)
        let http = FakeDeletionHTTP()
        check(restart.pendingRevocation == record && http.requests.isEmpty)
        rejects { try restart.completeNeverAttemptedRemoval(registrationID: id, proof: .neverAttempted) }
        check(restart.pendingRevocation == record && memory.bytes == durable && http.requests.isEmpty)
        let defaultOffRestart = try ServiceExperimentJournal(storage: memory)
        check(defaultOffRestart.pendingRevocation == record)
        await rejectsAsync { try await deletion(defaultOffRestart, http) }
        check(http.requests.isEmpty && memory.bytes == durable)
        rejects { _ = try stage(restart, id: UUID()) }
        await rejectsAsync { try await deletion(restart, http, origin: URL(string: "https://different.invalid")!) }
        await rejectsAsync { try await deletion(restart, http, origin: URL(string: "http://synthetic.invalid:9443")!) }
        check(http.requests.isEmpty && memory.bytes == durable)
        http.fail = true
        await rejectsAsync { try await deletion(restart, http) }
        check(restart.pendingRevocation == record && memory.bytes == durable)
        let first = http.requests[0]
        check(first.method == "DELETE" && first.path == "/public/service_activity_registrations/\(id.uuidString.lowercased())")
        check(first.body == nil && first.headers == ["X-Service-Activity-Secret": capability])
        http.fail = false
        for response in [
            ServiceRegistrationResponse(status: 200, headers: ["Cache-Control": "no-store"], body: Data()),
            ServiceRegistrationResponse(status: 204, headers: [:], body: Data()),
            ServiceRegistrationResponse(status: 204, headers: ["Cache-Control": "no-store"], body: Data("{}".utf8))
        ] {
            http.response = response
            await rejectsAsync { try await deletion(restart, http) }
            check(memory.bytes == durable)
        }
        http.response = ServiceRegistrationResponse(status: 204, headers: ["CACHE-CONTROL": "private, No-Store"], body: Data())
        memory.failRemove = true
        await rejectsAsync { try await deletion(restart, http) }
        check(memory.bytes == durable)
        memory.failRemove = false
        try await deletion(restart, http)
        check(memory.bytes == nil && restart.pendingRevocation == nil)
        let count = http.requests.count
        try await deletion(restart, http)
        try restart.requestRemoval(registrationID: id)
        check(http.requests.count == count)
        check(http.requests.allSatisfy { $0.path == first.path && $0.headers == first.headers })

        // Old completion cannot erase a newer follow, even after successful removal.
        let nextID = UUID(uuidString: "e54ad734-cbb0-417f-ae4d-696cb1dd1440")!
        let next = try stage(restart, id: nextID)
        let nextBytes = memory.bytes
        try await deletion(restart, http) // Old id: idempotent, never touches next.
        try restart.requestRemoval(registrationID: id)
        check(restart.recoveryRecord == next && memory.bytes == nextBytes && http.requests.count == count)
        await rejectsAsync { try await deletion(restart, http, id: UUID()) }
        check(restart.recoveryRecord == next)

        // Cancellation intent and new-follow exclusion are established before await.
        try restart.requestRemoval(registrationID: nextID)
        http.suspend = true
        let task = Task { try await deletion(restart, http, id: nextID) }
        // A continuation handshake, not timing/yield/polling, proves suspension.
        await withCheckedContinuation { started in
            http.onSend = {
                check(restart.pendingRevocation == next)
                rejects { _ = try stage(restart, id: UUID()) }
                started.resume()
            }
        }
        await rejectsAsync { try await deletion(restart, http, id: nextID) }
        rejects { try restart.completeNeverAttemptedRemoval(registrationID: nextID, proof: .neverAttempted) }
        check(memory.bytes == nextBytes)
        http.continuation!.resume()
        try await task.value
        check(memory.bytes == nil)

        // Fresh begin -> no token / no PUT -> local transport proof: no DELETE404
        // trap. The exact matching durable item may be cleared without any HTTP.
        let localMemory = MemorySecrets()
        let localJournal = try ServiceExperimentJournal(storage: localMemory, enabled: true)
        let localRecord = try stage(localJournal)
        let noIO = FakeDeletionHTTP()
        let transport = ServiceRegistrationTransport(enabled: true, http: noIO)
        let handle = try transport.begin(identity: localRecord.identity, activityID: localRecord.activityID,
                                         capability: localRecord.capability, id: localRecord.registrationID)
        let proof = try await transport.remove(handle)
        check(proof == .neverAttempted && noIO.requests.isEmpty)
        let localBytes = localMemory.bytes
        rejects { try localJournal.completeNeverAttemptedRemoval(registrationID: UUID(), proof: proof) }
        check(localMemory.bytes == localBytes)
        rejects { try localJournal.completeNeverAttemptedRemoval(registrationID: id, proof: .acknowledged) }
        check(localJournal.pendingRevocation == localRecord && localMemory.bytes == localBytes)
        localMemory.failRemove = true
        rejects { try localJournal.completeNeverAttemptedRemoval(registrationID: id, proof: proof) }
        check(localJournal.pendingRevocation == localRecord && localMemory.bytes == localBytes)
        rejects { _ = try stage(localJournal, id: UUID()) }
        // A new process still cannot abandon this record, even given the enum value.
        let restoredLocal = try ServiceExperimentJournal(storage: localMemory, enabled: true)
        rejects { try restoredLocal.completeNeverAttemptedRemoval(registrationID: id, proof: proof) }
        check(localMemory.bytes == localBytes)
        localMemory.failRemove = false
        // Byte mismatch also fails closed rather than deleting an unrelated item.
        localMemory.bytes = Data("different-synthetic-item".utf8)
        rejects { try localJournal.completeNeverAttemptedRemoval(registrationID: id, proof: proof) }
        check(localJournal.pendingRevocation == localRecord && localMemory.bytes == Data("different-synthetic-item".utf8))
        localMemory.bytes = localBytes
        try localJournal.completeNeverAttemptedRemoval(registrationID: id, proof: proof)
        check(localJournal.recoveryRecord == nil && localMemory.bytes == nil && noIO.requests.isEmpty)
        try localJournal.completeNeverAttemptedRemoval(registrationID: id, proof: proof)
        let newer = try stage(localJournal, id: nextID)
        let newerBytes = localMemory.bytes
        try localJournal.completeNeverAttemptedRemoval(registrationID: id, proof: proof)
        check(localJournal.recoveryRecord == newer && localMemory.bytes == newerBytes && noIO.requests.isEmpty)

        // Corrupt/local validation failure preserves bytes and cannot perform I/O.
        memory.bytes = Data("not-a-record".utf8)
        rejects { _ = try ServiceExperimentJournal(storage: memory, enabled: true) }
        check(memory.bytes == Data("not-a-record".utf8))
        print("ExperimentJournalTests: \(checks) checks passed (synthetic memory + fake HTTP only)")
    }
}
