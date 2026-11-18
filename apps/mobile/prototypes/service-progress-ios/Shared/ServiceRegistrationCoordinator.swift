import Foundation

// Explicit, bounded retry preparation. No token observation, timers, removal,
// ActivityKit or HTTP driver activation. One immutable follow for this lifetime.
@MainActor
final class ServiceRegistrationCoordinator: CustomStringConvertible, CustomDebugStringConvertible {
    private let transport: ServiceRegistrationTransport
    private let follow: ServiceRegistrationFollow
    private var candidate: String?
    private var queued: String?
    private var draining = false
    private var cancelled = false
    private(set) var failure: ServiceRegistrationFailure?
    var needsRetry: Bool { !cancelled && (candidate != nil || queued != nil) }
    var isReconciling: Bool { draining }
    nonisolated var description: String { "ServiceRegistrationCoordinator([redacted])" }
    nonisolated var debugDescription: String { description }

    init(transport: ServiceRegistrationTransport, follow: ServiceRegistrationFollow) {
        self.transport = transport
        self.follow = follow
    }

    func receive(token: String) async {
        guard !cancelled else { return }
        let token = token.lowercased()
        guard (2...200).contains(token.utf8.count), token.utf8.count.isMultiple(of: 2),
              token.utf8.allSatisfy({ (48...57).contains($0) || (97...102).contains($0) }) else {
            failure = .invalidInput
            return
        }
        if let candidate {
            // A failed/in-flight candidate is never replaced before its receipt.
            // Only the most recent subsequent token is retained, bounded to one.
            queued = token == candidate ? nil : token
        } else {
            candidate = token
        }
        await drain()
    }

    // Recovery does not depend on pushTokenUpdates emitting the same token again.
    // No automatic retry loop: at most two PUTs (candidate + one queued rotation).
    func retry() async {
        guard !cancelled else { return }
        await drain()
    }

    // In-flight HTTP may already have committed and cannot be undone here. The
    // bridge must separately end/remove the follow; this suppresses all later work.
    func cancel() {
        cancelled = true
        candidate = nil
        queued = nil
        failure = nil
    }

    private func drain() async {
        guard !draining, !cancelled else { return }
        draining = true
        defer { draining = false }
        for _ in 0..<2 {
            guard !cancelled, let token = candidate else { return }
            do {
                _ = try await transport.register(follow, token: token)
                guard !cancelled else { return }
                failure = nil
                candidate = queued
                queued = nil
            } catch {
                guard !cancelled else { return }
                failure = (error as? ServiceRegistrationFailure) ?? .transport
                return // Retain EXACT candidate, including uncertain receipt failures.
            }
        }
        // A token received during the second await remains candidate for an
        // explicit retry; neither concurrent receive/retry starts duplicate I/O.
    }
}
