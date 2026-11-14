import ActivityKit
import Foundation

// Explicitly inactive preparation. The local harness requests pushType:nil and
// never constructs this bridge. No provider, URLSession, background timer or push
// capability is enabled here. An explicitly configured caller must supply consent,
// a cryptographically random capability and a reviewed registration HTTP driver.
@MainActor
final class ServiceActivityRegistrationBridge {
    private let enabled: Bool
    private let transport: ServiceRegistrationTransport
    private var current: (activity: Activity<ServicePublicationIdentity>, follow: ServiceRegistrationFollow,
                          coordinator: ServiceRegistrationCoordinator)?
    private var tokenTask: Task<Void, Never>?
    private var removing = false
    private var revoked = false
    private(set) var failure: ServiceRegistrationFailure?

    init(transport: ServiceRegistrationTransport, enabled: Bool = false) {
        self.transport = transport
        self.enabled = enabled
    }

    func observe(_ activity: Activity<ServicePublicationIdentity>, disclosed: Bool, capability: String) throws {
        guard enabled else { throw ServiceRegistrationFailure.disabled }
        guard disclosed else { throw ServiceRegistrationFailure.invalidInput }
        guard current == nil else { throw ServiceRegistrationFailure.removalRequired }
        let follow = try transport.begin(identity: activity.attributes, activityID: activity.id, capability: capability)
        let coordinator = ServiceRegistrationCoordinator(transport: transport, follow: follow)
        current = (activity, follow, coordinator)
        revoked = false
        failure = nil
        tokenTask = Task { [weak self] in
            for await bytes in activity.pushTokenUpdates {
                guard !Task.isCancelled, let self, self.current?.follow == follow else { return }
                let token = bytes.map { String(format: "%02x", $0) }.joined()
                // Coordinator retains an ambiguous candidate until exact retry
                // succeeds, then reconciles a bounded latest token rotation.
                await coordinator.receive(token: token)
                guard !Task.isCancelled, self.current?.follow == follow else { return }
                self.failure = coordinator.failure
            }
        }
    }

    // Explicit foreground recovery when no further token event arrives. No
    // autonomous background retry/cadence is implied by this entry point.
    @discardableResult
    func retryRegistration() async throws -> Bool {
        guard enabled else { throw ServiceRegistrationFailure.disabled }
        guard !removing else { throw ServiceRegistrationFailure.busy }
        guard !revoked, let previous = current else { throw ServiceRegistrationFailure.staleFollow }
        guard !previous.coordinator.isReconciling else { throw ServiceRegistrationFailure.busy }
        await previous.coordinator.retry()
        guard !revoked, current?.follow == previous.follow else { throw ServiceRegistrationFailure.staleFollow }
        failure = previous.coordinator.failure
        if let failure { throw failure }
        return !previous.coordinator.needsRetry // false means a bounded queued rotation still needs reconciliation.
    }

    var needsRegistrationRetry: Bool { !revoked && (current?.coordinator.needsRetry ?? false) }

    // Revoke locally even if the server cannot currently acknowledge removal.
    // Keep the old handle for idempotent deletion retry; no new follow can start.
    func remove() async throws {
        guard !removing else { throw ServiceRegistrationFailure.busy }
        removing = true
        defer { removing = false }
        tokenTask?.cancel()
        tokenTask = nil
        guard let previous = current else { return }
        revoked = true
        previous.coordinator.cancel()
        await previous.activity.end(nil, dismissalPolicy: .immediate)
        do {
            try await transport.remove(previous.follow)
            current = nil
            failure = nil
        } catch let error as ServiceRegistrationFailure {
            failure = error
            throw error
        } catch {
            failure = .transport
            throw ServiceRegistrationFailure.transport
        }
    }

    deinit { tokenTask?.cancel() }
}
