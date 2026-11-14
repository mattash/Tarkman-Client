import Foundation

/// Presentation data only: no private text, credentials, percentage, or ETA.
struct ServicePublicationPresentation: Equatable {
    enum Freshness: Equatable {
        case recent, stale, invalid, removed
    }

    let status: String
    let freshness: Freshness
    let title: String?
    let ordinal: Int?
    let total: Int?
    let role: String?
    let updatedAt: Date?
    let tapURL: URL?
}

enum ServicePublicationValidator {
    private static let statuses: Set<String> = ["active", "paused", "unavailable", "deleted", "ended"]
    private static let roles: Set<String> = [
        "priest", "deacon", "choir", "people", "instruction", "title", "leader", "all", "clergy",
    ]

    static func isValid(_ state: ServicePublicationV1, identity: ServicePublicationIdentity, now: Date) -> Bool {
        let source = state.updatedAt.timeIntervalSinceReferenceDate
        let expiry = state.expiresAt.timeIntervalSinceReferenceDate
        let clock = now.timeIntervalSinceReferenceDate
        return state.schemaVersion == 1
            && identity.serviceID > 0 && state.sessionID == identity.serviceID
            && readerURL(identity: identity) != nil
            && canonicalUUID(identity.generation) && state.generation == identity.generation
            && state.sequence > 0 && statuses.contains(state.status)
            && (state.serviceTitle?.count ?? 0) <= 120
            && source.isFinite && expiry.isFinite && clock.isFinite
            && source <= clock && expiry > source && expiry - source <= 60
    }

    /// Stateless Widget projection. It cannot compare a previous sequence or enforce
    /// replay ordering. APNs OS timestamp ordering is separate; same-second backend
    /// publication ordering remains tracked in #552. No redraw/wakeup is promised.
    static func presentation(
        _ state: ServicePublicationV1,
        identity: ServicePublicationIdentity,
        now: Date,
        nativeIsStale: Bool = false
    ) -> ServicePublicationPresentation {
        guard isValid(state, identity: identity, now: now) else {
            return empty(status: "invalid", freshness: .invalid)
        }
        let stale = nativeIsStale || now >= state.expiresAt
        let freshness: ServicePublicationPresentation.Freshness = stale ? .stale : .recent
        guard !isTerminal(state.status) else {
            return ServicePublicationPresentation(
                status: state.status, freshness: freshness, title: nil,
                ordinal: nil, total: nil, role: nil, updatedAt: state.updatedAt, tapURL: nil
            )
        }

        // These are already backend-projected occurrence fields, not a manifest.
        // Never derive an ordinal from occurrenceID, deduplicate repeated IDs, or
        // synthesize a role. A context is required to trust any manifest count.
        let hasContext = !(state.contentContext?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
        var ordinal: Int?
        var total: Int?
        var role: String?
        if hasContext {
            if state.occurrenceID == nil && state.ordinal == nil && state.role == nil,
               let count = state.total, count >= 0 {
                // A known empty count (0) is not unknown, and is not "complete".
                total = count
            } else if let occurrence = state.occurrenceID, occurrence > 0,
                      let position = state.ordinal, position > 0,
                      let count = state.total, count >= position {
                ordinal = position
                total = count
                if let value = state.role, roles.contains(value) { role = value }
            }
        }
        if stale {
            // Source freshness does not renew merely because presentation is read.
            ordinal = nil
            role = nil
        }
        return ServicePublicationPresentation(
            status: state.status, freshness: freshness, title: state.serviceTitle,
            ordinal: ordinal, total: total, role: role, updatedAt: state.updatedAt,
            // Origin is immutable follow configuration, never dynamic content.
            tapURL: readerURL(identity: identity)
        )
    }

    fileprivate static func isTerminal(_ status: String) -> Bool {
        status == "unavailable" || status == "deleted" || status == "ended"
    }

    fileprivate static func empty(
        status: String, freshness: ServicePublicationPresentation.Freshness
    ) -> ServicePublicationPresentation {
        ServicePublicationPresentation(
            status: status, freshness: freshness, title: nil, ordinal: nil,
            total: nil, role: nil, updatedAt: nil, tapURL: nil
        )
    }

    /// A supplied origin fails closed: malformed configuration never silently
    /// redirects a development service ID to the production reader. Nil alone
    /// retains the historical synthetic baseline's known public origin.
    private static func readerURL(identity: ServicePublicationIdentity) -> URL? {
        let origin = identity.readerOrigin ?? "https://web.tarkman.app"
        // Reject escapes, whitespace, credentials and any path before URL parsing
        // can normalize them. Accept DNS/IPv4 or bracketed IPv6 authority only.
        let authorityPattern = #"^https://(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:]+\])(?::[0-9]{1,5})?$"#
        guard identity.serviceID > 0,
              origin.utf8.allSatisfy({ $0 > 32 && $0 < 127 }),
              origin.range(of: authorityPattern, options: .regularExpression) != nil,
              var components = URLComponents(string: origin),
              components.scheme == "https", let host = components.host, !host.isEmpty,
              components.user == nil, components.password == nil,
              components.path.isEmpty, components.query == nil, components.fragment == nil else { return nil }
        if let port = components.port, !(1...65535).contains(port) { return nil }
        if !host.hasPrefix("[") {
            // Reject malformed DNS labels rather than relying on URL's permissive
            // host parser. No resolution or network request is performed.
            let labels = host.split(separator: ".", omittingEmptySubsequences: false)
            guard host.count <= 253, labels.allSatisfy({ label in
                !label.isEmpty && label.count <= 63 && label.first != "-" && label.last != "-"
            }) else { return nil }
        }
        components.path = "/sessions/\(identity.serviceID)/parts"
        return components.url
    }

    private static func canonicalUUID(_ value: String) -> Bool {
        guard let uuid = UUID(uuidString: value) else { return false }
        return uuid.uuidString.lowercased() == value
    }
}

/// In-memory foreground ordering only. Not an APNs/ActivityKit ordering guard,
/// persistence layer, authentication boundary, or background subscription.
struct ServicePublicationStore {
    let identity: ServicePublicationIdentity
    private var snapshot: ServicePublicationV1?
    private var removed = false

    init(identity: ServicePublicationIdentity) {
        self.identity = identity
    }

    @discardableResult
    mutating func accept(_ state: ServicePublicationV1, now: Date) -> Bool {
        guard !removed,
              ServicePublicationValidator.isValid(state, identity: identity, now: now) else { return false }
        if let previous = snapshot {
            guard !ServicePublicationValidator.isTerminal(previous.status),
                  state.sequence > previous.sequence,
                  state.updatedAt >= previous.updatedAt else { return false }
        }
        // Same-source-time higher sequence is accepted LOCALLY, not an assertion
        // that two APNs updates in one Unix second are ordered by the OS.
        snapshot = state
        return true
    }

    mutating func remove() {
        snapshot = nil
        removed = true
    }

    func presentation(now: Date, nativeIsStale: Bool = false) -> ServicePublicationPresentation {
        if removed { return ServicePublicationValidator.empty(status: "removed", freshness: .removed) }
        guard let snapshot else {
            return ServicePublicationValidator.empty(status: "waiting", freshness: .invalid)
        }
        return ServicePublicationValidator.presentation(
            snapshot, identity: identity, now: now, nativeIsStale: nativeIsStale
        )
    }
}
