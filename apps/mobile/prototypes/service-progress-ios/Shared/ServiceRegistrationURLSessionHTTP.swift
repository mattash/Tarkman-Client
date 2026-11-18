import Foundation
import CoreFoundation

// Opt-in development HTTP driver, OFF by default.
// Caller must explicitly supply an HTTPS origin and enable it after all activation
// gates. No token stream, provider, credentials, or production origin is supplied.
@MainActor
final class ServiceRegistrationURLSessionHTTP: ServiceRegistrationHTTP,
    CustomStringConvertible, CustomDebugStringConvertible {
    private let baseURL: URL
    private let enabled: Bool
    nonisolated var description: String { "ServiceRegistrationURLSessionHTTP([redacted])" }
    nonisolated var debugDescription: String { description }

    init(baseURL: URL, enabled: Bool = false, simulatorFixture: Bool = false) throws {
        let loopback = simulatorFixture && ServiceRemoteExperimentConfiguration.admitsLoopbackHTTP(baseURL)
        guard !simulatorFixture || loopback,
              let origin = URLComponents(url: baseURL, resolvingAgainstBaseURL: false),
              (origin.scheme == "https" || loopback), let host = origin.host, !host.isEmpty,
              origin.user == nil, origin.password == nil, origin.query == nil,
              origin.fragment == nil, origin.path.isEmpty || origin.path == "/" else {
            throw ServiceRegistrationFailure.invalidInput
        }
        self.baseURL = baseURL
        self.enabled = enabled
    }

    // Testable policy only: does not instantiate a session or perform I/O.
    func prepare(_ request: ServiceRegistrationRequest) throws -> URLRequest {
        guard enabled else { throw ServiceRegistrationFailure.disabled }
        let prefix = "/public/service_activity_registrations/"
        guard request.path.hasPrefix(prefix) else { throw ServiceRegistrationFailure.invalidInput }
        let segments = request.path.dropFirst(prefix.count).split(separator: "/", omittingEmptySubsequences: false)
        let revocation = segments.count == 2 && segments[1] == "revoke"
        guard segments.count == 1 || revocation else { throw ServiceRegistrationFailure.invalidInput }
        let id = String(segments[0])
        guard UUID(uuidString: id)?.uuidString.lowercased() == id,
              (request.method == "POST") == revocation,
              let secret = request.headers["X-Service-Activity-Secret"],
              (32...512).contains(secret.utf8.count),
              secret.utf8.allSatisfy({ (33...126).contains($0) }) else {
            throw ServiceRegistrationFailure.invalidInput
        }
        switch request.method {
        case "PUT":
            guard Set(request.headers.keys) == Set(["Content-Type", "X-Service-Activity-Secret"]),
                  request.headers["Content-Type"] == "application/json",
                  let body = request.body, !body.isEmpty, body.count <= 4096 else {
                throw ServiceRegistrationFailure.invalidInput
            }
        case "POST":
            // Additive backend #556 capability-owned revocation fence. Never a
            // token/version input; validates identity even for an absent row.
            guard Set(request.headers.keys) == Set(["Content-Type", "X-Service-Activity-Secret"]),
                  request.headers["Content-Type"] == "application/json",
                  let body = request.body, !body.isEmpty, body.count <= 4096,
                  let object = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
                  Set(object.keys) == Set(["session_id", "activity_id", "generation"]),
                  let session = object["session_id"] as? NSNumber,
                  CFGetTypeID(session) != CFBooleanGetTypeID(),
                  !["f", "d"].contains(String(cString: session.objCType)),
                  session.int64Value > 0,
                  let activity = object["activity_id"] as? String, (1...200).contains(activity.utf8.count),
                  let generation = object["generation"] as? String,
                  UUID(uuidString: generation)?.uuidString.lowercased() == generation else {
                throw ServiceRegistrationFailure.invalidInput
            }
        case "DELETE":
            guard Set(request.headers.keys) == Set(["X-Service-Activity-Secret"]), request.body == nil else {
                throw ServiceRegistrationFailure.invalidInput
            }
        default: throw ServiceRegistrationFailure.invalidInput
        }
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        components.path = request.path
        guard let url = components.url else { throw ServiceRegistrationFailure.invalidInput }
        var wire = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        wire.httpMethod = request.method
        wire.allHTTPHeaderFields = request.headers
        wire.httpBody = request.body
        wire.httpShouldHandleCookies = false
        return wire
    }

    static func configuration() -> URLSessionConfiguration {
        let config = URLSessionConfiguration.ephemeral
        config.urlCache = nil
        config.urlCredentialStorage = nil
        config.httpCookieStorage = nil
        config.httpShouldSetCookies = false
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        return config
    }

    func send(_ request: ServiceRegistrationRequest) async throws -> ServiceRegistrationResponse {
        let wire = try prepare(request) // Default-off failure occurs before session creation.
        let guardDelegate = ServiceRegistrationRedirectGuard()
        let session = URLSession(configuration: Self.configuration(), delegate: guardDelegate, delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        do {
            let (bytes, response) = try await session.bytes(for: wire)
            guard let response = response as? HTTPURLResponse else { throw ServiceRegistrationFailure.transport }
            guard response.expectedContentLength <= 4096 else { throw ServiceRegistrationFailure.invalidReceipt }
            var data = Data()
            for try await byte in bytes {
                guard data.count < 4096 else { throw ServiceRegistrationFailure.invalidReceipt }
                data.append(byte)
            }
            // Keep only the one receipt-policy header, never arbitrary server data.
            let headers = response.value(forHTTPHeaderField: "Cache-Control")
                .map { ["Cache-Control": $0] } ?? [:]
            return ServiceRegistrationResponse(status: response.statusCode, headers: headers, body: data)
        } catch {
            // Includes TLS/cancellation/redirect/authentication/size errors; no URL,
            // response body, underlying NSError or capability is exposed in errors.
            throw ServiceRegistrationFailure.transport
        }
    }
}

// Reject ALL redirects, even same-origin: never replay a capability-bearing request.
final class ServiceRegistrationRedirectGuard: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                    completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
        completionHandler(nil)
    }

    func urlSession(_ session: URLSession, task: URLSessionTask,
                    didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping @Sendable (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        // System TLS trust evaluation only; never answer HTTP/password/client-cert
        // challenges from shared credentials or prompt the user for credentials.
        completionHandler(challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust
            ? .performDefaultHandling : .cancelAuthenticationChallenge, nil)
    }
}
