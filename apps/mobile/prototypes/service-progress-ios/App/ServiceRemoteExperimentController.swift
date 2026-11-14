import ActivityKit
import Combine
import Foundation
import UIKit

// Opt-in caller for the separate development app only. Default configuration
// constructs no HTTP driver, accesses no Keychain item and requests no push token.
@MainActor
final class ServiceRemoteExperimentController: ObservableObject {
    let configuration: ServiceRemoteExperimentConfiguration?
    @Published var serviceInput = "" {
        didSet {
            if serviceInput != oldValue {
                selection = nil
                disclosed = false
                selectionNonce = UUID()
            }
        }
    }
    @Published var disclosed = false
    @Published private(set) var selection: ServicePublicSelection?
    @Published private(set) var busy = false
    @Published private(set) var isActive = false
    @Published private(set) var pendingRecovery = false
    @Published private(set) var messageKey = "remoteDisabled"
    private var journal: ServiceExperimentJournal?
    private var activity: Activity<ServicePublicationIdentity>?
    private var bridge: ServiceActivityRegistrationBridge?
    private var activityTask: Task<Void, Never>?
    private var selectionNonce = UUID()

    var configured: Bool {
        configuration?.remoteEnabled == true && configuration?.developmentOrigin != nil &&
        configuration?.developmentReaderOrigin != nil
    }
    var canVerify: Bool { configured && journal != nil && !busy && !isActive && !pendingRecovery }
    var canStart: Bool { canVerify && selection != nil && disclosed }

    init(info: [String: Any] = Bundle.main.infoDictionary ?? [:]) {
        configuration = try? ServiceRemoteExperimentConfiguration(info: info)
        guard configuration != nil else { messageKey = "remoteInvalidConfiguration"; return }
        guard configured else { return }
        do {
            let value = try ServiceExperimentJournal(storage: ServiceExperimentKeychain(), enabled: true)
            journal = value
            pendingRecovery = value.pendingRevocation != nil
            messageKey = pendingRecovery ? "remoteRevocationPending" : "remoteSelectService"
        } catch {
            messageKey = "remoteStorageUnavailable"
        }
    }

    func verifySelection() async {
        guard canVerify, let origin = configuration?.developmentOrigin,
              let id = Int(serviceInput), id > 0 else { messageKey = "remoteInvalidSelection"; return }
        busy = true
        disclosed = false
        selection = nil
        let nonce = UUID()
        selectionNonce = nonce
        defer { busy = false }
        do {
            let driver = try ServicePublicSelectionURLSessionHTTP(baseURL: origin, enabled: true)
            let verified = try await ServicePublicSelectionVerifier(http: driver, enabled: true).verify(serviceID: id)
            guard selectionNonce == nonce, Int(serviceInput) == id else { return }
            selection = verified
            messageKey = "remotePublicVerified"
        } catch {
            guard selectionNonce == nonce else { return }
            messageKey = "remoteVerificationFailed"
        }
    }

    func start() async {
        guard canStart, let selected = selection, Int(serviceInput) == selected.serviceID,
              let origin = configuration?.developmentOrigin,
              let reader = configuration?.developmentReaderOrigin, let journal,
              journal.recoveryRecord == nil else { return }
        guard UIApplication.shared.applicationState == .active else { messageKey = "remoteForegroundOnly"; return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { messageKey = "unavailable"; return }
        busy = true
        defer { busy = false }
        var requested: Activity<ServicePublicationIdentity>?
        do {
            let identity = ServicePublicationIdentity(serviceID: selected.serviceID,
                generation: UUID().uuidString.lowercased(), readerOrigin: reader.absoluteString)
            let state = try selected.publication(identity: identity, now: Date())
            guard ServicePublicationValidator.isValid(state, identity: identity, now: Date()) else {
                throw ServicePublicSelectionFailure.invalidResponse
            }
            let capability = try ServiceExperimentKeychain.freshCapability()
            let registrationID = UUID()
            // Explicit remote configuration + verified service + fresh per-service
            // disclosure are all required BEFORE this actual .token request path.
            let target = try Activity.request(attributes: identity,
                content: ActivityContent(state: state, staleDate: state.expiresAt), pushType: .token)
            requested = target
            let http = try ServiceRegistrationURLSessionHTTP(baseURL: origin, enabled: true)
            let transport = ServiceRegistrationTransport(enabled: true, http: http)
            let next = ServiceActivityRegistrationBridge(transport: transport, enabled: true)
            activity = target
            bridge = next
            // Persist after local begin validation, BEFORE any token observation/PUT.
            try next.observe(target, disclosed: disclosed, capability: capability, registrationID: registrationID) {
                _ = try journal.stage(origin: origin, identity: identity, activityID: target.id,
                                      capability: capability, registrationID: registrationID, consented: self.disclosed)
            }
            isActive = true
            pendingRecovery = false
            messageKey = "remoteObservationStarted"
            activityTask = Task { [weak self] in
                for await state in target.activityStateUpdates {
                    guard !Task.isCancelled, let self, self.activity?.id == target.id else { return }
                    if state == .ended || state == .dismissed {
                        self.bridge?.invalidateLocally()
                        self.isActive = false
                        self.disclosed = false
                        try? self.journal?.requestRemoval(registrationID: registrationID)
                        self.pendingRecovery = self.journal?.recoveryRecord != nil
                        self.messageKey = "remoteRevocationPending"
                        return
                    }
                }
            }
        } catch ServicePublicSelectionFailure.stale {
            selection = nil
            disclosed = false
            messageKey = "remoteSelectionExpired"
        } catch {
            if let bridge, let proof = try? await bridge.remove(), proof == .neverAttempted,
               let record = journal.recoveryRecord {
                try? journal.requestRemoval(registrationID: record.registrationID)
                try? journal.completeNeverAttemptedRemoval(registrationID: record.registrationID, proof: proof)
            }
            if let requested { await requested.end(nil, dismissalPolicy: .immediate) }
            activity = nil; bridge = nil; isActive = false
            disclosed = false
            pendingRecovery = journal.recoveryRecord != nil
            messageKey = pendingRecovery ? "remoteRevocationPending" : "remoteStartFailed"
        }
    }

    // Explicit recovery does not rely on a second token event or background time.
    // Completing a retry pass is NOT evidence of an APNs push/display result.
    func retryRegistration() async {
        guard configured, !busy, isActive, let bridge else { return }
        busy = true
        defer { busy = false }
        do {
            let complete = try await bridge.retryRegistration()
            messageKey = complete ? "remoteRetryPassComplete" : "remoteRetryRemaining"
        } catch {
            messageKey = "remoteRetryRemaining"
        }
    }

    func remove() async {
        guard configured, !busy, let origin = configuration?.developmentOrigin, let journal else { return }
        busy = true
        disclosed = false
        activityTask?.cancel()
        activityTask = nil
        defer { busy = false }
        guard let record = journal.recoveryRecord else {
            if let activity { await activity.end(nil, dismissalPolicy: .immediate) }
            activity = nil; bridge = nil; isActive = false
            messageKey = "remoteRemoved"
            return
        }
        // Mark local invalidation before any suspension or network operation.
        do { try journal.requestRemoval(registrationID: record.registrationID) }
        catch {
            if let activity { await activity.end(nil, dismissalPolicy: .immediate) }
            isActive = false; pendingRecovery = true; messageKey = "remoteStorageUnavailable"
            return
        }
        isActive = false
        pendingRecovery = true
        do {
            if let bridge {
                let result = try await bridge.remove()
                if result == .neverAttempted {
                    try journal.completeNeverAttemptedRemoval(registrationID: record.registrationID, proof: .neverAttempted)
                } else {
                    // Idempotent second DELETE confirms the durable journal's exact
                    // record/origin before clearing it. No fabricated HTTP receipt.
                    let http = try ServiceRegistrationURLSessionHTTP(baseURL: origin, enabled: true)
                    try await journal.retryDeletion(registrationID: record.registrationID, configuredOrigin: origin, http: http)
                }
            } else {
                // Relaunch never recreates a transport/follow or restores consent.
                // An ambiguous persisted registration can only be revoked remotely.
                if let activity { await activity.end(nil, dismissalPolicy: .immediate) }
                let http = try ServiceRegistrationURLSessionHTTP(baseURL: origin, enabled: true)
                try await journal.retryDeletion(registrationID: record.registrationID, configuredOrigin: origin, http: http)
            }
            activity = nil; bridge = nil; selection = nil
            pendingRecovery = false; messageKey = "remoteRemoved"
        } catch {
            // Preserve the durable capability for an explicit same-origin retry.
            messageKey = "remoteRevocationPending"
        }
    }

    deinit { activityTask?.cancel() }
}
