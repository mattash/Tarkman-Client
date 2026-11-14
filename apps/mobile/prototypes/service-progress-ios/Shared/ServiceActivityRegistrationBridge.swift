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
    private var current: (activity: Activity<ServicePublicationIdentity>, follow: ServiceRegistrationFollow)?
    private var tokenTask: Task<Void, Never>?
    private var removing = false
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
        current = (activity, follow)
        failure = nil
        tokenTask = Task { [weak self] in
            for await bytes in activity.pushTokenUpdates {
                guard !Task.isCancelled, let self, self.current?.follow == follow else { return }
                let token = bytes.map { String(format: "%02x", $0) }.joined()
                do {
                    // Adapter serializes on MainActor; rotating token replaces the
                    // prior token atomically through the same capability registration.
                    _ = try await self.transport.register(follow, token: token)
                    guard !Task.isCancelled, self.current?.follow == follow else { return }
                    self.failure = nil
                } catch let error as ServiceRegistrationFailure {
                    guard !Task.isCancelled, self.current?.follow == follow else { return }
                    self.failure = error
                } catch {
                    guard !Task.isCancelled, self.current?.follow == follow else { return }
                    self.failure = .transport
                }
            }
        }
    }

    // Revoke locally even if the server cannot currently acknowledge removal.
    // Keep the old handle for idempotent deletion retry; no new follow can start.
    func remove() async throws {
        guard !removing else { throw ServiceRegistrationFailure.busy }
        removing = true
        defer { removing = false }
        tokenTask?.cancel()
        tokenTask = nil
        guard let previous = current else { return }
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
