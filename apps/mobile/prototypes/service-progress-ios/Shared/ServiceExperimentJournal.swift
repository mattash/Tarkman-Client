import Foundation

// Deletion-only recovery. Implementations must never overwrite an existing item,
// and must only remove the exact expected bytes. No default disk/defaults storage.
@MainActor
protocol ServiceExperimentSecretStorage {
    func load() throws -> Data?
    func saveIfAbsent(_ data: Data) throws
    func removeIfMatching(_ data: Data) throws
}

enum ServiceExperimentJournalFailure: Error, CustomStringConvertible, CustomDebugStringConvertible {
    case disabled, consentRequired, pendingRecovery, invalidRecord, storage, staleFollow
    case originMismatch, busy, transport, invalidDeletionReceipt
    var description: String { "ServiceExperimentJournalFailure([redacted])" }
    var debugDescription: String { description }
}

struct ServiceExperimentRecoveryRecord: Codable, Equatable, CustomStringConvertible, CustomDebugStringConvertible {
    let origin: URL
    let registrationID: UUID
    let identity: ServicePublicationIdentity
    let activityID: String
    // Sensitive: only consume for registration/deletion, never log or copy to defaults.
    let capability: String
    let createdAt: Date
    var description: String { "ServiceExperimentRecoveryRecord([redacted])" }
    var debugDescription: String { description }
}

@MainActor
final class ServiceExperimentJournal: CustomStringConvertible, CustomDebugStringConvertible {
    private let storage: ServiceExperimentSecretStorage
    private let enabled: Bool
    private let now: () -> Date
    private var savedBytes: Data?
    private var removing = false
    private var sending = false
    // Process-local provenance, deliberately never persisted or inferred from phase.
    // A restored record can ONLY be cleared by an acknowledged remote deletion.
    private var stagedInCurrentProcess: UUID?
    private var completed = Set<UUID>()
    private(set) var recoveryRecord: ServiceExperimentRecoveryRecord?
    var pendingRevocation: ServiceExperimentRecoveryRecord? { removing ? recoveryRecord : nil }
    nonisolated var description: String { "ServiceExperimentJournal([redacted])" }
    nonisolated var debugDescription: String { description }

    // Loading never restores consent, creates a follow, or performs remote I/O.
    // Invalid/unreadable storage fails closed and remains untouched.
    init(storage: ServiceExperimentSecretStorage, enabled: Bool = false,
         now: @escaping () -> Date = Date.init) throws {
        self.storage = storage
        self.enabled = enabled
        self.now = now
        let bytes: Data?
        do { bytes = try storage.load() }
        catch { throw ServiceExperimentJournalFailure.storage }
        if let bytes {
            guard let record = try? JSONDecoder().decode(ServiceExperimentRecoveryRecord.self, from: bytes),
                  Self.valid(record) else { throw ServiceExperimentJournalFailure.invalidRecord }
            recoveryRecord = record
            savedBytes = bytes
            removing = true
        }
    }

    // Caller independently establishes selected public-service eligibility and fresh
    // explicit consent. Persist BEFORE register/observing tokens; local begin validation may precede it.
    // A durable record blocks every subsequent follow, including while DELETE awaits.
    func stage(origin: URL, identity: ServicePublicationIdentity, activityID: String,
               capability: String, registrationID: UUID = UUID(), consented: Bool) throws -> ServiceExperimentRecoveryRecord {
        guard enabled else { throw ServiceExperimentJournalFailure.disabled }
        guard consented else { throw ServiceExperimentJournalFailure.consentRequired }
        guard recoveryRecord == nil, !sending else { throw ServiceExperimentJournalFailure.pendingRecovery }
        let record = ServiceExperimentRecoveryRecord(origin: origin, registrationID: registrationID,
            identity: identity, activityID: activityID, capability: capability, createdAt: now())
        guard Self.valid(record), !completed.contains(registrationID) else {
            throw ServiceExperimentJournalFailure.invalidRecord
        }
        let bytes: Data
        do {
            bytes = try JSONEncoder().encode(record)
            try storage.saveIfAbsent(bytes)
        } catch { throw ServiceExperimentJournalFailure.storage }
        savedBytes = bytes
        recoveryRecord = record
        stagedInCurrentProcess = registrationID
        removing = false
        return record
    }

    // Synchronous local invalidation: call BEFORE awaiting isolated Activity end.
    // This durable record already represents deletion intent after any termination;
    // no consent/token/version is persisted and no additional save is necessary.
    func requestRemoval(registrationID: UUID) throws {
        if completed.contains(registrationID) { return }
        guard recoveryRecord?.registrationID == registrationID else {
            throw ServiceExperimentJournalFailure.staleFollow
        }
        removing = true
    }

    // Only pass the matching bridge/transport removal result, never manufacture
    // proof. No PUT attempt means no remote registration could exist. This escape
    // hatch is strictly process-local: launch recovery cannot reconstruct that fact.
    func completeNeverAttemptedRemoval(registrationID: UUID, proof: ServiceRegistrationRemoval) throws {
        if completed.contains(registrationID) { return }
        guard let record = recoveryRecord, let bytes = savedBytes,
              record.registrationID == registrationID else {
            throw ServiceExperimentJournalFailure.staleFollow
        }
        removing = true // Invalidate before validation/clear; storage errors retain intent.
        guard !sending else { throw ServiceExperimentJournalFailure.busy }
        guard stagedInCurrentProcess == registrationID, proof == .neverAttempted else {
            throw ServiceExperimentJournalFailure.invalidRecord
        }
        do { try storage.removeIfMatching(bytes) }
        catch { throw ServiceExperimentJournalFailure.storage }
        completed.insert(registrationID)
        recoveryRecord = nil
        savedBytes = nil
        stagedInCurrentProcess = nil
        removing = false
    }

    // Explicit user/caller retry only. The supplied driver MUST be bound to this
    // configured origin. Existing ServiceRegistrationHTTP carries relative paths;
    // never pair this argument with a driver configured for another origin.
    func retryDeletion(registrationID: UUID, configuredOrigin: URL, http: ServiceRegistrationHTTP) async throws {
        if completed.contains(registrationID) { return }
        guard let record = recoveryRecord, let bytes = savedBytes,
              record.registrationID == registrationID else {
            throw ServiceExperimentJournalFailure.staleFollow
        }
        removing = true // Cancellation intent precedes every validation and await.
        guard enabled else { throw ServiceExperimentJournalFailure.disabled }
        guard !sending else { throw ServiceExperimentJournalFailure.busy }
        guard Self.valid(record), let configured = Self.originKey(configuredOrigin),
              configured == Self.originKey(record.origin) else {
            throw ServiceExperimentJournalFailure.originMismatch
        }
        sending = true
        defer { sending = false }
        let response: ServiceRegistrationResponse
        do {
            response = try await http.send(ServiceRegistrationRequest(method: "DELETE",
                path: "/public/service_activity_registrations/\(record.registrationID.uuidString.lowercased())",
                headers: ["X-Service-Activity-Secret": record.capability], body: nil))
        } catch { throw ServiceExperimentJournalFailure.transport }
        guard response.status == 204, response.body.isEmpty,
              response.headers.contains(where: { key, value in
                  key.lowercased() == "cache-control" && value.lowercased().split(separator: ",").contains {
                      $0.trimmingCharacters(in: .whitespaces) == "no-store"
                  }
              }) else { throw ServiceExperimentJournalFailure.invalidDeletionReceipt }
        // No callback, including a stale follow completion, can clear a newer item.
        guard recoveryRecord == record, savedBytes == bytes else {
            throw ServiceExperimentJournalFailure.staleFollow
        }
        do { try storage.removeIfMatching(bytes) }
        catch { throw ServiceExperimentJournalFailure.storage }
        completed.insert(record.registrationID)
        recoveryRecord = nil
        savedBytes = nil
        stagedInCurrentProcess = nil
        removing = false
    }

    private static func valid(_ record: ServiceExperimentRecoveryRecord) -> Bool {
        originKey(record.origin) != nil && record.identity.serviceID > 0 &&
        UUID(uuidString: record.identity.generation)?.uuidString.lowercased() == record.identity.generation &&
        (1...200).contains(record.activityID.utf8.count) &&
        (32...512).contains(record.capability.utf8.count) && record.capability.utf8.allSatisfy {
            (65...90).contains($0) || (97...122).contains($0) || (48...57).contains($0) || $0 == 45 || $0 == 95
        } && record.createdAt.timeIntervalSinceReferenceDate.isFinite
    }

    private static func originKey(_ url: URL) -> String? {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == "https", let host = parts.host, !host.isEmpty,
              parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
              parts.path.isEmpty || parts.path == "/", (1...65535).contains(parts.port ?? 443) else { return nil }
        return "https://\(host.lowercased()):\(parts.port ?? 443)"
    }
}
