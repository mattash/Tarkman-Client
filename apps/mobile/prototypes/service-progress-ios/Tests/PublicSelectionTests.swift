import Foundation

@MainActor
private final class FakePublicHTTP: ServicePublicSelectionHTTP {
    var responses: [ServicePublicSelectionResponse]
    var calls: [(Int, Bool)] = []
    init(_ responses: [ServicePublicSelectionResponse]) { self.responses = responses }
    func get(serviceID: Int, state: Bool) async throws -> ServicePublicSelectionResponse {
        calls.append((serviceID, state))
        guard !responses.isEmpty else { throw ServicePublicSelectionFailure.transport }
        return responses.removeFirst()
    }
}

@main
struct PublicSelectionTests {
    static let now = Date(timeIntervalSince1970: 1_700_000_000)
    static let dateHeader = "Tue, 14 Nov 2023 22:13:20 GMT"
    static let generation = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

    static func response(id: Int = 71, status: String = "active", revision: Int = 8,
                         title: String? = "Divine Liturgy", code: Int = 200,
                         headers: [String: String]? = nil, body: Data? = nil) -> ServicePublicSelectionResponse {
        var session: [String: Any] = ["id": id, "status": status, "revision": revision,
                                      "date": "2023-11-14", "cursor": NSNull()]
        session["liturgy"] = title
        return ServicePublicSelectionResponse(status: code,
            headers: headers ?? ["Date": dateHeader, "Content-Type": "application/json; charset=utf-8"],
            body: body ?? (try! JSONSerialization.data(withJSONObject: ["session": session])))
    }

    @MainActor
    static func reject(_ responses: [ServicePublicSelectionResponse], clock: Date = now, id: Int = 71) async {
        do {
            _ = try await ServicePublicSelectionVerifier(http: FakePublicHTTP(responses), enabled: true,
                                                        clock: { clock }).verify(serviceID: id)
            fatalError("accepted invalid public selection")
        } catch {}
    }

    @MainActor
    static func main() async throws {
        let fake = FakePublicHTTP([response(title: nil), response()])
        do { _ = try await ServicePublicSelectionVerifier(http: fake).verify(serviceID: 71); fatalError("default enabled") }
        catch ServicePublicSelectionFailure.disabled {}
        precondition(fake.calls.isEmpty)
        let selection = try await ServicePublicSelectionVerifier(http: fake, enabled: true, clock: { now }).verify(serviceID: 71)
        precondition(fake.calls.count == 2 && fake.calls[0].0 == 71 && fake.calls[0].1 && !fake.calls[1].1)
        precondition(selection.serviceID == 71 && selection.title == "Divine Liturgy" && selection.stateRevision == 8)
        let identity = ServicePublicationIdentity(serviceID: 71, generation: generation)
        let publication = try selection.publication(identity: identity, now: now.addingTimeInterval(59))
        precondition(publication.sequence == 1 && publication.updatedAt == now && publication.expiresAt == now.addingTimeInterval(60))
        precondition(publication.ordinal == nil && publication.total == nil && publication.role == nil
                     && publication.occurrenceID == nil && publication.contentContext == nil)
        precondition(ServicePublicationValidator.isValid(publication, identity: identity, now: now))
        for time in [now.addingTimeInterval(60), now.addingTimeInterval(-1), Date(timeIntervalSinceReferenceDate: .nan)] {
            do { _ = try selection.publication(identity: identity, now: time); fatalError("renewed stale selection") } catch {}
        }
        do {
            _ = try selection.publication(identity: ServicePublicationIdentity(serviceID: 72, generation: generation), now: now)
            fatalError("mismatched identity")
        } catch {}
        do {
            _ = try selection.publication(identity: ServicePublicationIdentity(serviceID: 71, generation: "invalid"), now: now)
            fatalError("invalid generation")
        } catch {}
        let paused = try await ServicePublicSelectionVerifier(http: FakePublicHTTP([response(status: "paused"), response(status: "paused")]),
                                                              enabled: true, clock: { now }).verify(serviceID: 71)
        precondition(paused.status == "paused")
        for id in [0, -1] { await reject([], id: id) }
        for code in [301, 302, 304, 401, 403, 404, 500] { await reject([response(code: code)]) }
        for bad in [response(id: 72), response(status: "ended"), response(status: "inactive"),
                    response(status: "showing_custom"), response(revision: -1)] { await reject([bad, response()]) }
        for bad in [response(id: 72), response(status: "paused"), response(revision: 9), response(title: nil),
                    response(title: ""), response(title: " \n"), response(title: String(repeating: "a", count: 121)),
                    response(title: "title\nprivate text")] { await reject([response(), bad]) }
        await reject([response(), response(body: Data("{\"session\":{\"id\":71}}".utf8))])
        await reject([response(body: Data("{\"error\":\"private\"}".utf8))])
        await reject([response(body: Data(repeating: 32, count: 65_537))])
        await reject([]) // Failed read is never a cached fallback.
        for headers in [
            ["Content-Type": "application/json"],
            ["Date": dateHeader, "Content-Type": "text/html"],
            ["Date": dateHeader, "Content-Type": "application/json", "Age": "1"],
            ["Date": dateHeader, "Content-Type": "application/json", "Age": "-1"],
            ["Date": dateHeader, "Content-Type": "application/json", "Warning": "110 stale"],
            ["Date": "Tue, 14 Nov 2023 22:13:19 GMT", "Content-Type": "application/json"],
            ["Date": "Tue, 14 Nov 2023 22:13:21 GMT", "Content-Type": "application/json"],
            ["Date": "invalid", "Content-Type": "application/json"],
            ["Date": dateHeader, "date": dateHeader, "Content-Type": "application/json"],
        ] {
            // The preceding whole second is permitted only within the one-second
            // Date precision allowance; test it at a fractional local clock.
            await reject([response(headers: headers), response()], clock: now.addingTimeInterval(0.5))
        }
        await reject([response(), response()], clock: Date(timeIntervalSinceReferenceDate: .nan))
        await reject([response(), response()], clock: now.addingTimeInterval(61))
        // A sub-second receipt does not become a new source timestamp, and
        // mixed fresh server Dates keep the OLDEST read's expiry.
        var coherentClocks = [now.addingTimeInterval(0.5), now.addingTimeInterval(0.5),
                              now.addingTimeInterval(1.5), now.addingTimeInterval(1.5)]
        let newerHeaders = ["Date": "Tue, 14 Nov 2023 22:13:21 GMT", "Content-Type": "application/json", "Age": "0"]
        let bounded = try await ServicePublicSelectionVerifier(
            http: FakePublicHTTP([response(), response(headers: newerHeaders)]), enabled: true,
            clock: { coherentClocks.removeFirst() }).verify(serviceID: 71)
        precondition(bounded.validatedAt == now)
        let boundedPublication = try bounded.publication(identity: identity, now: now.addingTimeInterval(2))
        precondition(boundedPublication.updatedAt == now && boundedPublication.expiresAt == now.addingTimeInterval(60))
        var backwardsReadClocks = [now, now.addingTimeInterval(0.5), now, now]
        do {
            _ = try await ServicePublicSelectionVerifier(http: FakePublicHTTP([response(), response()]), enabled: true,
                                                        clock: { backwardsReadClocks.removeFirst() }).verify(serviceID: 71)
            fatalError("backwards read clock")
        } catch {}
        var samples = [now, now, now, now.addingTimeInterval(-1)]
        do {
            _ = try await ServicePublicSelectionVerifier(http: FakePublicHTTP([response(), response()]), enabled: true,
                                                        clock: { samples.removeFirst() }).verify(serviceID: 71)
            fatalError("backwards clock")
        } catch {}

        let origin = URL(string: "https://public-experiment.invalid")!
        let driver = try ServicePublicSelectionURLSessionHTTP(baseURL: origin)
        do { _ = try driver.prepare(serviceID: 71, state: true); fatalError("driver default enabled") }
        catch ServicePublicSelectionFailure.disabled {}
        let enabledDriver = try ServicePublicSelectionURLSessionHTTP(baseURL: origin, enabled: true)
        for state in [true, false] {
            let request = try enabledDriver.prepare(serviceID: 71, state: state)
            precondition(request.url?.absoluteString == "https://public-experiment.invalid/s/71\(state ? "/state" : "").json")
            precondition(request.httpMethod == "GET" && request.httpBody == nil && !request.httpShouldHandleCookies)
            precondition(request.value(forHTTPHeaderField: "Authorization") == nil
                         && request.value(forHTTPHeaderField: "Cookie") == nil)
            precondition(Set(request.allHTTPHeaderFields!.keys.map { $0.lowercased() }) == ["accept", "cache-control", "pragma"])
        }
        let config = ServiceRegistrationURLSessionHTTP.configuration()
        precondition(config.urlCache == nil && config.urlCredentialStorage == nil && config.httpCookieStorage == nil)
        print("Public selection tests passed (anonymous request policy + fake HTTP only; no I/O)")
    }
}
