import Foundation

// Pure policy tests: no task is resumed and no outbound request is performed.
// swiftc -swift-version 6 -warnings-as-errors -strict-concurrency=complete \
//   Shared/ServicePublicationV1.swift Shared/ServiceRegistrationTransport.swift \
//   Shared/ServiceRegistrationURLSessionHTTP.swift Tests/RegistrationHTTPTests.swift \
//   -o /tmp/registration-http-tests
@main
@MainActor
private struct RegistrationHTTPTests {
    static var checks = 0
    static let origin = URL(string: "https://synthetic.invalid:9443")!
    static let path = "/public/service_activity_registrations/e54ad734-cbb0-417f-ae4d-696cb1dd1439"
    static let secret = String(repeating: "synthetic-only-", count: 4)
    static func check(_ condition: Bool) {
        precondition(condition)
        checks += 1
    }
    static func reject(_ block: () throws -> Void) {
        do { try block(); preconditionFailure("Expected rejection") }
        catch let error as ServiceRegistrationFailure {
            check(!String(reflecting: error).contains(secret))
        } catch { preconditionFailure("Unsanitized error") }
    }
    static func request(method: String = "PUT", path: String = path,
                        headers: [String: String]? = nil, body: Data? = Data("{}".utf8)) -> ServiceRegistrationRequest {
        ServiceRegistrationRequest(method: method, path: path,
            headers: headers ?? ["Content-Type": "application/json", "X-Service-Activity-Secret": secret], body: body)
    }
    static func main() async throws {
        let disabled = try ServiceRegistrationURLSessionHTTP(baseURL: origin)
        reject { _ = try disabled.prepare(request()) }
        do { _ = try await disabled.send(request()); preconditionFailure("Default must be off") }
        catch ServiceRegistrationFailure.disabled { checks += 1 }
        check(!String(reflecting: disabled).contains(origin.absoluteString))
        for url in ["http://synthetic.invalid", "https://user@synthetic.invalid", "https://user:password@synthetic.invalid",
                    "https://synthetic.invalid?query", "https://synthetic.invalid?", "https://synthetic.invalid#fragment",
                    "https://synthetic.invalid#", "https://synthetic.invalid/path", "file:///tmp/synthetic"] {
            reject { _ = try ServiceRegistrationURLSessionHTTP(baseURL: URL(string: url)!, enabled: true) }
        }
        let driver = try ServiceRegistrationURLSessionHTTP(baseURL: origin, enabled: true)
        let wire = try driver.prepare(request())
        check(wire.url?.absoluteString == origin.absoluteString + path)
        check(wire.httpMethod == "PUT" && wire.httpBody == Data("{}".utf8))
        check(wire.value(forHTTPHeaderField: "X-Service-Activity-Secret") == secret)
        check(!wire.httpShouldHandleCookies && wire.cachePolicy == .reloadIgnoringLocalCacheData)
        for badPath in ["https://other.invalid" + path, path + "?q=1", path + "#fragment", path + "/extra",
                        "/public/service_activity_registrations/../other", "/public/service_activity_registrations/%65" + String(path.suffix(35)),
                        "/public/service_activity_registrations/E54AD734-CBB0-417F-AE4D-696CB1DD1439", "/s/42/state"] {
            reject { _ = try driver.prepare(request(path: badPath)) }
        }
        for method in ["GET", "POST", "PATCH", "put"] {
            reject { _ = try driver.prepare(request(method: method)) }
        }
        reject { _ = try driver.prepare(request(body: Data(repeating: 1, count: 4097))) }
        reject { _ = try driver.prepare(request(body: nil)) }
        reject { _ = try driver.prepare(request(body: Data())) }
        check(try driver.prepare(request(body: Data(repeating: 1, count: 4096))).httpBody?.count == 4096)
        reject { _ = try driver.prepare(request(headers: ["X-Service-Activity-Secret": secret, "Authorization": "must-not-forward"])) }
        reject { _ = try driver.prepare(request(headers: ["X-Service-Activity-Secret": secret + "\r\nInjected: bad", "Content-Type": "application/json"])) }
        reject { _ = try driver.prepare(request(method: "DELETE", body: nil)) } // Extra content type forbidden.
        let deletion = request(method: "DELETE", headers: ["X-Service-Activity-Secret": secret], body: nil)
        check(try driver.prepare(deletion).httpBody == nil)
        // Additive #556 revocation is the ONLY permitted POST. Pure request
        // construction tests: no URLSession request is ever resumed.
        let revokePath = path + "/revoke"
        let generation = "62eb2844-f523-4f19-a8b0-ab8ace413563"
        let identity: [String: Any] = ["session_id": 77, "activity_id": "synthetic-activity", "generation": generation]
        let revokeBody = try JSONSerialization.data(withJSONObject: identity)
        let revocation = request(method: "POST", path: revokePath, body: revokeBody)
        reject { _ = try disabled.prepare(revocation) }
        let preparedRevocation = try driver.prepare(revocation)
        check(preparedRevocation.httpMethod == "POST" && preparedRevocation.httpBody == revokeBody)
        check(preparedRevocation.url?.absoluteString == origin.absoluteString + revokePath)
        check(preparedRevocation.value(forHTTPHeaderField: "X-Service-Activity-Secret") == secret)
        check(!String(reflecting: revocation).contains(secret))
        for badPath in [path, revokePath + "/", revokePath + "/extra", revokePath + "?q=1", revokePath + "#fragment",
                        path + "//revoke", path + "/%72evoke", path + "/Revoke", path + "/revoke\n",
                        path.uppercased() + "/revoke", "/public/service_activity_registrations//revoke"] {
            reject { _ = try driver.prepare(request(method: "POST", path: badPath, body: revokeBody)) }
        }
        for method in ["GET", "PUT", "DELETE", "PATCH", "post"] {
            reject { _ = try driver.prepare(request(method: method, path: revokePath, body: revokeBody)) }
        }
        for badBody: Data? in [nil, Data(), Data("not-json".utf8), Data("[]".utf8), Data("null".utf8), Data(repeating: 32, count: 4097)] {
            reject { _ = try driver.prepare(request(method: "POST", path: revokePath, body: badBody)) }
        }
        for field in identity.keys {
            var missing = identity
            missing.removeValue(forKey: field)
            let body = try JSONSerialization.data(withJSONObject: missing)
            reject { _ = try driver.prepare(request(method: "POST", path: revokePath, body: body)) }
        }
        for (field, value): (String, Any) in [
            ("push_token", "aabb"), ("token_version", 1), ("session_id", true), ("session_id", "77"),
            ("session_id", 0), ("session_id", -1), ("session_id", 77.5), ("session_id", NSNull()),
            ("activity_id", ""), ("activity_id", String(repeating: "a", count: 201)),
            ("activity_id", String(repeating: "é", count: 101)), ("activity_id", 7), ("activity_id", NSNull()),
            ("generation", generation.uppercased()), ("generation", "bad"), ("generation", 7), ("generation", NSNull())
        ] {
            var malformed = identity
            malformed[field] = value
            let body = try JSONSerialization.data(withJSONObject: malformed)
            reject { _ = try driver.prepare(request(method: "POST", path: revokePath, body: body)) }
        }
        for rawSession in ["77.0", "77e0", "9223372036854775808", "18446744073709551615"] {
            let body = Data("{\"session_id\":\(rawSession),\"activity_id\":\"synthetic\",\"generation\":\"\(generation)\"}".utf8)
            reject { _ = try driver.prepare(request(method: "POST", path: revokePath, body: body)) }
        }
        reject { _ = try driver.prepare(request(method: "POST", path: revokePath,
            headers: ["X-Service-Activity-Secret": secret], body: revokeBody)) }
        reject { _ = try driver.prepare(request(method: "POST", path: revokePath,
            headers: ["Content-Type": "application/json", "X-Service-Activity-Secret": secret, "Authorization": "forbidden"], body: revokeBody)) }
        reject { _ = try driver.prepare(request(method: "POST", path: revokePath,
            headers: ["Content-Type": "application/json", "X-Service-Activity-Secret": secret + "\r\nInjected: bad"], body: revokeBody)) }
        let configuration = ServiceRegistrationURLSessionHTTP.configuration()
        check(configuration.urlCache == nil && configuration.urlCredentialStorage == nil && configuration.httpCookieStorage == nil)
        check(!configuration.httpShouldSetCookies && configuration.requestCachePolicy == .reloadIgnoringLocalCacheData)
        check(configuration.timeoutIntervalForRequest == 15 && configuration.timeoutIntervalForResource == 30)
        // Exercise the actual redirect delegate with synthetic metadata only.
        let session = URLSession(configuration: configuration)
        defer { session.invalidateAndCancel() }
        let task = session.dataTask(with: origin) // Never resumed.
        defer { task.cancel() }
        let guardDelegate = ServiceRegistrationRedirectGuard()
        for destination in [origin, URL(string: "https://other.invalid")!] {
            let response = HTTPURLResponse(url: origin, statusCode: 307, httpVersion: nil, headerFields: ["Location": destination.absoluteString])!
            guardDelegate.urlSession(session, task: task, willPerformHTTPRedirection: response,
                newRequest: URLRequest(url: destination)) { redirected in
                    precondition(redirected == nil, "Capability-bearing requests must never redirect")
                }
            checks += 1
        }
        print("RegistrationHTTPTests: \(checks) checks passed (policy only; no outbound network)")
    }
}
