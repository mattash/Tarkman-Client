import Foundation

/// Standalone deterministic tests; no XCTest, ActivityKit, network, or wall clock.
/// swiftc Shared/ServicePublicationV1.swift Shared/ServicePublicationValidation.swift \
///   Tests/PublicationValidationTests.swift -o /tmp/publication-validation-tests
/// /tmp/publication-validation-tests
@main
struct PublicationValidationTests {
    static let generation = "a1111111-2222-4333-8444-555555555555"
    static let identity = ServicePublicationIdentity(serviceID: 42, generation: generation)
    static let source = Date(timeIntervalSinceReferenceDate: 1_000)
    static var assertions = 0

    static func state(
        version: Int = 1, service: Int = 42, generation: String = generation,
        sequence: Int = 1, context: String? = "synthetic-context", title: String? = "Synthetic service",
        status: String = "active", occurrence: Int? = 12, ordinal: Int? = 2,
        total: Int? = 3, role: String? = "choir", issued: Double = 1_000, expiry: Double = 1_060
    ) -> ServicePublicationV1 {
        ServicePublicationV1(
            schemaVersion: version, sessionID: service, generation: generation, sequence: sequence,
            stateRevision: nil, contentContext: context, serviceTitle: title, status: status,
            occurrenceID: occurrence, ordinal: ordinal, total: total, role: role,
            updatedAt: Date(timeIntervalSinceReferenceDate: issued),
            expiresAt: Date(timeIntervalSinceReferenceDate: expiry)
        )
    }

    static func project(_ value: ServicePublicationV1, at time: Double = 1_000, stale: Bool = false) -> ServicePublicationPresentation {
        ServicePublicationValidator.presentation(
            value, identity: identity, now: Date(timeIntervalSinceReferenceDate: time), nativeIsStale: stale
        )
    }

    static func check(_ condition: @autoclosure () -> Bool, _ message: String, line: Int = #line) {
        assertions += 1
        precondition(condition(), "line \(line): \(message)")
    }

    static func checkEmpty(_ value: ServicePublicationPresentation) {
        check(value.title == nil && value.ordinal == nil && value.total == nil && value.role == nil,
              "empty presentation contains no title/progress")
        check(value.tapURL == nil, "empty presentation cannot navigate")
    }

    static func main() {
        identityAndEnvelope()
        clocksAndStaleness()
        coherenceAndRoles()
        foregroundOrdering()
        terminalAndRemoval()
        print("PublicationValidationTests: \(assertions) assertions passed")
    }

    static func identityAndEnvelope() {
        let valid = project(state())
        check(valid.status == "active" && valid.freshness == .recent, "valid active")
        check(valid.title == "Synthetic service" && valid.updatedAt == source, "public metadata")
        check(valid.ordinal == 2 && valid.total == 3 && valid.role == "choir", "authoritative position")
        check(valid.tapURL?.absoluteString == "https://web.tarkman.app/sessions/42/parts", "known reader URL only")
        let components = URLComponents(url: valid.tapURL!, resolvingAgainstBaseURL: false)!
        check(components.scheme == "https" && components.host == "web.tarkman.app", "HTTPS host")
        check(components.user == nil && components.password == nil && components.query == nil && components.fragment == nil,
              "credential-free route, no token or query")

        let invalid = [
            state(version: 0), state(version: 2), state(service: 43), state(service: 0),
            state(generation: "b1111111-2222-4333-8444-555555555555"),
            state(generation: generation.uppercased()), state(generation: "not-a-uuid"),
            state(sequence: 0), state(sequence: -1), state(status: "unknown"), state(status: "ACTIVE"),
            state(title: String(repeating: "x", count: 121)),
        ]
        for value in invalid {
            check(!ServicePublicationValidator.isValid(value, identity: identity, now: source), "invalid envelope")
            let presentation = project(value)
            check(presentation.status == "invalid" && presentation.freshness == .invalid, "invalid classification")
            check(presentation.updatedAt == nil, "invalid source hidden")
            checkEmpty(presentation)
        }
        check(project(state(title: String(repeating: "é", count: 120))).freshness == .recent, "120-character bound inclusive")
        check(project(state(title: nil)).title == nil, "title unknown remains unknown")
        let uppercaseIdentity = ServicePublicationIdentity(serviceID: 42, generation: generation.uppercased())
        check(!ServicePublicationValidator.isValid(state(generation: generation.uppercased()), identity: uppercaseIdentity, now: source),
              "matching uppercase UUIDs still noncanonical")
        let badService = ServicePublicationIdentity(serviceID: 0, generation: generation)
        check(!ServicePublicationValidator.isValid(state(service: 0), identity: badService, now: source), "identity must be positive")
        check(project(state(status: "paused")).status == "paused", "paused supported")
    }

    static func clocksAndStaleness() {
        for value in [state(issued: 1_001), state(expiry: 1_000), state(expiry: 999), state(expiry: 1_060.001),
                      state(issued: .nan), state(issued: .infinity), state(issued: -.infinity),
                      state(expiry: .nan), state(expiry: .infinity), state(expiry: -.infinity)] {
            check(project(value).freshness == .invalid, "invalid source/window")
        }
        for time in [Double.nan, .infinity, -.infinity, 999] {
            check(project(state(), at: time).freshness == .invalid, "invalid/future clock")
        }
        check(project(state(expiry: 1_000.5)).freshness == .recent, "positive fractional window")
        check(project(state(), at: 1_059.999).ordinal == 2, "recent just before expiry")
        for value in [project(state(), at: 1_060), project(state(), at: 5_000), project(state(), stale: true)] {
            check(value.freshness == .stale, "expiry boundary/native stale")
            check(value.ordinal == nil && value.role == nil, "stale hides current position and role")
            check(value.total == 3 && value.updatedAt == source, "stale retains count and original source")
        }
        var store = ServicePublicationStore(identity: identity)
        check(store.accept(state(), now: source), "initial snapshot accepted")
        let later = Date(timeIntervalSinceReferenceDate: 1_061)
        let stale = store.presentation(now: later)
        check(stale.freshness == .stale && stale.ordinal == nil && stale.role == nil, "clock alone makes store stale, no publication rerun")
        check(store.presentation(now: later) == stale, "reading does not renew source or expiry")
        check(!store.accept(state(), now: later), "expired replay cannot refresh snapshot")
        var expiredStore = ServicePublicationStore(identity: identity)
        check(expiredStore.accept(state(), now: later), "expired but valid snapshots accepted")
        check(expiredStore.presentation(now: later).freshness == .stale, "expired acceptance never claims fresh")
    }

    static func coherenceAndRoles() {
        for value in [
            state(context: nil), state(context: ""), state(context: " \n"),
            state(occurrence: nil), state(occurrence: 0), state(occurrence: -1),
            state(ordinal: nil), state(ordinal: 0), state(ordinal: -1), state(ordinal: 4),
            state(total: nil), state(total: 0), state(total: -1),
        ] {
            let result = project(value)
            check(result.freshness == .recent, "optional incoherence does not invalidate envelope")
            check(result.ordinal == nil && result.role == nil && result.total == nil, "incoherent tuple suppressed")
        }
        let unknown = project(state(context: nil, occurrence: nil, ordinal: nil, total: nil, role: nil))
        check(unknown.total == nil && unknown.ordinal == nil && unknown.role == nil, "unknown not fabricated as zero")
        let zero = project(state(occurrence: nil, ordinal: nil, total: 0, role: nil))
        check(zero.total == 0 && zero.ordinal == nil && zero.role == nil, "coherent known zero")
        let countOnly = project(state(occurrence: nil, ordinal: nil, total: 3, role: nil))
        check(countOnly.total == 3 && countOnly.ordinal == nil, "count known without current occurrence")
        let one = project(state(occurrence: 999, ordinal: 1, total: 1))
        check(one.ordinal == 1 && one.total == 1, "one of one is ordinal, not completion percentage")
        for role in ["priest", "deacon", "choir", "people", "instruction", "title", "leader", "all", "clergy"] {
            check(project(state(role: role)).role == role, "real backend role \(role)")
        }
        for role in ["unknown", "reader", "CHOIR", "", "secret-text"] {
            let result = project(state(role: role))
            check(result.role == nil && result.ordinal == 2 && result.total == 3, "unknown role omitted, no invented localization key")
        }
        check(project(state(role: nil)).ordinal == 2, "unknown role does not invalidate known position")
        var store = ServicePublicationStore(identity: identity)
        check(store.accept(state(), now: source), "first occurrence")
        check(store.accept(state(sequence: 2, ordinal: 3), now: source), "same occurrence ID may appear again")
        check(store.presentation(now: source).ordinal == 3, "no occurrence deduplication/ID-derived ordinal")
    }

    static func foregroundOrdering() {
        var store = ServicePublicationStore(identity: identity)
        check(store.presentation(now: source).status == "waiting", "initially waiting")
        checkEmpty(store.presentation(now: source))
        check(store.accept(state(sequence: 2), now: source), "first sequence need not equal one")
        let accepted = store.presentation(now: source)
        for value in [state(sequence: 2), state(sequence: 1), state(sequence: 3, issued: 999, expiry: 1_059),
                      state(version: 2, sequence: 99), state(service: 43, sequence: 99)] {
            check(!store.accept(value, now: source), "replay/older/backwards/invalid rejected")
            check(store.presentation(now: source) == accepted, "rejection does not overwrite source")
        }
        check(store.accept(state(sequence: 3, ordinal: 3), now: source), "same-time higher sequence accepted LOCALLY")
        check(store.presentation(now: source).ordinal == 3, "local sequence orders equal source dates")
        let later = Date(timeIntervalSinceReferenceDate: 1_001)
        check(!store.accept(state(sequence: 2, issued: 1_001, expiry: 1_061), now: later), "newer time cannot override older sequence")
        check(store.accept(state(sequence: 5, issued: 1_001, expiry: 1_061), now: later), "forward sequence gaps allowed")
        // Stateless projection has no previous state: both independent snapshots
        // render. This test explicitly does NOT assert APNs same-second ordering.
        check(project(state(sequence: 1)).freshness == .recent, "stateless does not compare prior sequence")
        check(project(state(sequence: 99)).freshness == .recent, "stateless does not claim replay protection")
    }

    static func terminalAndRemoval() {
        for status in ["unavailable", "deleted", "ended"] {
            var store = ServicePublicationStore(identity: identity)
            check(store.accept(state(), now: source), "initial active")
            check(store.accept(state(sequence: 2, status: status), now: source), "terminal accepted")
            let terminal = store.presentation(now: source)
            check(terminal.status == status && terminal.freshness == .recent, "authoritative terminal retained")
            checkEmpty(terminal)
            check(!store.accept(state(sequence: 3), now: source), "terminal never revives")
            check(!store.accept(state(sequence: 4, status: "deleted"), now: source), "conservative terminal latch rejects subsequent payloads")
            check(store.presentation(now: source) == terminal, "terminal unchanged")
            checkEmpty(store.presentation(now: Date(timeIntervalSinceReferenceDate: 1_061)))
            store.remove()
            check(store.presentation(now: source).freshness == .removed, "terminal removable")
        }
        var store = ServicePublicationStore(identity: identity)
        check(store.accept(state(), now: source), "before removal")
        store.remove()
        store.remove()
        let removed = store.presentation(now: source)
        check(removed.status == "removed" && removed.freshness == .removed, "idempotent removal")
        checkEmpty(removed)
        check(removed.updatedAt == nil, "removal clears source payload")
        check(!store.accept(state(sequence: 100), now: source), "late publication after removal rejected")
        check(store.presentation(now: source) == removed, "late publication cannot revive removed store")
        var removedBeforeAccept = ServicePublicationStore(identity: identity)
        removedBeforeAccept.remove()
        check(!removedBeforeAccept.accept(state(), now: source), "removed empty follow cannot revive")
        var refollow = ServicePublicationStore(identity: ServicePublicationIdentity(
            serviceID: 42, generation: "b1111111-2222-4333-8444-555555555555"
        ))
        check(!refollow.accept(state(sequence: 101), now: source), "old generation rejected after same-service refollow")
    }
}
