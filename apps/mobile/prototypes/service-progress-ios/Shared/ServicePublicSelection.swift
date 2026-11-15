import Foundation

/// Public contract inspected at Tarkman master / merged #553:
/// a03f61bc3b9b19bfa88984ebb63728524f6fb515, session controller and
/// _state.json.jbuilder / _session.json.jbuilder. /services/:id is a USER
/// lookup, not a session lookup. No account or display-link token belongs here.
enum ServicePublicSelectionFailure: Error { case disabled, invalidInput, unavailable, invalidResponse, stale, transport }

struct ServicePublicSelection {
    let serviceID: Int
    let title: String
    let status: String
    let stateRevision: Int?
    /// Oldest explicit server Date among the coherent successful reads. This is
    /// public-read validation time, NOT the time of a part transition / old push.
    let validatedAt: Date

    fileprivate init(serviceID: Int, title: String, status: String, stateRevision: Int, validatedAt: Date) {
        self.serviceID = serviceID
        self.title = title
        self.status = status
        self.stateRevision = stateRevision
        self.validatedAt = validatedAt
    }

    /// A one-time initial projection only. There is no coherent provider manifest
    /// in these public APIs: never infer occurrence/ordinal/total/role from them.
    /// Reusing the selection cannot extend its original 60-second budget.
    func publication(identity: ServicePublicationIdentity, now: Date) throws -> ServicePublicationV1 {
        guard identity.serviceID == serviceID,
              UUID(uuidString: identity.generation)?.uuidString.lowercased() == identity.generation else {
            throw ServicePublicSelectionFailure.invalidInput
        }
        guard now.timeIntervalSinceReferenceDate.isFinite, now >= validatedAt,
              now < validatedAt.addingTimeInterval(60) else { throw ServicePublicSelectionFailure.stale }
        return ServicePublicationV1(schemaVersion: 1, sessionID: serviceID, generation: identity.generation,
            sequence: 1, stateRevision: stateRevision, contentContext: nil, serviceTitle: title,
            status: status, occurrenceID: nil, ordinal: nil, total: nil, role: nil,
            updatedAt: validatedAt, expiresAt: validatedAt.addingTimeInterval(60))
    }
}

struct ServicePublicSelectionResponse {
    let status: Int
    let headers: [String: String]
    let body: Data
}

@MainActor
protocol ServicePublicSelectionHTTP {
    func get(serviceID: Int, state: Bool) async throws -> ServicePublicSelectionResponse
}

/// No cached fallback and no stored selection: a failed read cannot renew an old
/// success. A Date header is required on BOTH reads; civil `session.date` is NOT
/// a source timestamp. Current contract supplies no reliable transition date.
/// Matching revision/status ties the two snapshots together, not an atomic title
/// transaction or a proof of APNs freshness. Source progress remains unknown.
@MainActor
struct ServicePublicSelectionVerifier {
    private let enabled: Bool
    private let http: any ServicePublicSelectionHTTP
    private let clock: () -> Date
    static let maximumResponseBytes = 65_536

    init(http: any ServicePublicSelectionHTTP, enabled: Bool = false, clock: @escaping () -> Date = { Date() }) {
        self.http = http
        self.enabled = enabled
        self.clock = clock
    }

    func verify(serviceID: Int) async throws -> ServicePublicSelection {
        guard enabled else { throw ServicePublicSelectionFailure.disabled }
        guard serviceID > 0 else { throw ServicePublicSelectionFailure.invalidInput }
        let started = clock()
        guard started.timeIntervalSinceReferenceDate.isFinite else { throw ServicePublicSelectionFailure.stale }
        let state = try await read(serviceID: serviceID, state: true, started: started)
        let info = try await read(serviceID: serviceID, state: false, started: state.received)
        let finished = clock()
        let source = min(state.date, info.date)
        guard finished.timeIntervalSinceReferenceDate.isFinite, finished >= info.received,
              finished >= source, finished.timeIntervalSince(source) < 60,
              info.date >= state.date else { throw ServicePublicSelectionFailure.stale }
        guard state.session.id == serviceID, info.session.id == serviceID,
              state.session.revision >= 0, info.session.revision == state.session.revision,
              ["active", "paused"].contains(state.session.status),
              info.session.status == state.session.status,
              let title = info.session.liturgy, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              title.count <= 120, !title.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) else {
            throw ServicePublicSelectionFailure.invalidResponse
        }
        return ServicePublicSelection(serviceID: serviceID, title: title, status: state.session.status,
                                      stateRevision: state.session.revision, validatedAt: source)
    }

    private struct Envelope: Decodable {
        struct Session: Decodable { let id: Int; let status: String; let revision: Int; let liturgy: String? }
        let session: Session
        let error: String?
    }

    private func read(serviceID: Int, state: Bool, started: Date) async throws -> (session: Envelope.Session, date: Date, received: Date) {
        let response: ServicePublicSelectionResponse
        do { response = try await http.get(serviceID: serviceID, state: state) }
        catch { throw ServicePublicSelectionFailure.transport }
        guard response.status == 200 else { throw ServicePublicSelectionFailure.unavailable }
        guard response.body.count <= Self.maximumResponseBytes else { throw ServicePublicSelectionFailure.invalidResponse }
        // Header names are case-insensitive; ambiguous duplicates fail closed.
        var headers: [String: String] = [:]
        for (key, value) in response.headers {
            let name = key.lowercased()
            guard headers[name] == nil else { throw ServicePublicSelectionFailure.invalidResponse }
            headers[name] = value
        }
        guard headers["content-type"]?.lowercased().split(separator: ";").first?.trimmingCharacters(in: .whitespaces) == "application/json",
              let rawDate = headers["date"], let date = Self.serverDate(rawDate),
              headers["age"] == nil || headers["age"] == "0",
              headers["warning"] == nil else { throw ServicePublicSelectionFailure.stale }
        let received = clock()
        // Require server Date to lie within the current request window (one
        // second allowance only for HTTP Date's whole-second precision). Never
        // accept future clocks, 304, cache Age>0 or a stale pre-request Date.
        guard received.timeIntervalSinceReferenceDate.isFinite, received >= started,
              date <= received, date >= started.addingTimeInterval(-1),
              received.timeIntervalSince(date) < 60 else { throw ServicePublicSelectionFailure.stale }
        do {
            let decoded = try JSONDecoder().decode(Envelope.self, from: response.body)
            guard decoded.error == nil else { throw ServicePublicSelectionFailure.invalidResponse }
            return (decoded.session, date, received)
        } catch { throw ServicePublicSelectionFailure.invalidResponse }
    }

    private static func serverDate(_ raw: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss 'GMT'"
        formatter.isLenient = false
        guard let value = formatter.date(from: raw), formatter.string(from: value) == raw else { return nil }
        return value
    }
}

/// Anonymous GET only; disabled before session creation. Explicit trusted origin
/// is independent of public service ID and cannot be supplied by a reader link.
/// Reuses the registration driver's no-cookie/cache/credentials TLS policy and
/// all-redirect rejection; it never constructs capability-bearing requests.
@MainActor
final class ServicePublicSelectionURLSessionHTTP: ServicePublicSelectionHTTP {
    private let origin: URL
    private let enabled: Bool

    init(baseURL: URL, enabled: Bool = false) throws {
        guard let origin = ServiceRemoteExperimentConfiguration.explicitHTTPSOrigin(baseURL.absoluteString) else {
            throw ServicePublicSelectionFailure.invalidInput
        }
        self.origin = origin
        self.enabled = enabled
    }

    func prepare(serviceID: Int, state: Bool) throws -> URLRequest {
        guard enabled else { throw ServicePublicSelectionFailure.disabled }
        guard serviceID > 0 else { throw ServicePublicSelectionFailure.invalidInput }
        var parts = URLComponents(url: origin, resolvingAgainstBaseURL: false)!
        parts.path = "/s/\(serviceID)\(state ? "/state" : "").json"
        guard let url = parts.url else { throw ServicePublicSelectionFailure.invalidInput }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.httpMethod = "GET"
        request.httpShouldHandleCookies = false
        request.allHTTPHeaderFields = ["Accept": "application/json", "Cache-Control": "no-cache, no-store", "Pragma": "no-cache"]
        return request
    }

    func get(serviceID: Int, state: Bool) async throws -> ServicePublicSelectionResponse {
        let request = try prepare(serviceID: serviceID, state: state)
        let session = URLSession(configuration: ServiceRegistrationURLSessionHTTP.configuration(),
                                 delegate: ServiceRegistrationRedirectGuard(), delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        do {
            let (bytes, raw) = try await session.bytes(for: request)
            guard let response = raw as? HTTPURLResponse,
                  response.expectedContentLength <= ServicePublicSelectionVerifier.maximumResponseBytes else {
                throw ServicePublicSelectionFailure.invalidResponse
            }
            var body = Data()
            for try await byte in bytes {
                guard body.count < ServicePublicSelectionVerifier.maximumResponseBytes else {
                    throw ServicePublicSelectionFailure.invalidResponse
                }
                body.append(byte)
            }
            var headers: [String: String] = [:]
            for name in ["Content-Type", "Date", "Age", "Warning"] {
                headers[name] = response.value(forHTTPHeaderField: name)
            }
            return ServicePublicSelectionResponse(status: response.statusCode, headers: headers, body: body)
        } catch { throw ServicePublicSelectionFailure.transport }
    }
}
