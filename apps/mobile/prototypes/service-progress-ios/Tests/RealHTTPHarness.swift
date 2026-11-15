import Foundation

// Actual URLSession sockets only: no URLProtocol, fake responses, ActivityKit,
// Keychain, APNs or durable-storage claim. All subjects and token events synthetic.
private struct HarnessFailure: Error { let label: String }

@MainActor
private final class HTTPMemory: ServiceExperimentSecretStorage {
    var bytes: Data?
    var clears = 0
    func load() throws -> Data? { bytes }
    func saveIfAbsent(_ data: Data) throws {
        guard bytes == nil else { throw HarnessFailure(label: "memory overwrite") }
        bytes = data
    }
    func removeIfMatching(_ data: Data) throws {
        guard bytes == data else { throw HarnessFailure(label: "nonexact memory erase") }
        bytes = nil
        clears += 1
    }
}

// Observes the real driver without substituting any response or error. Staging
// is checked synchronously at the actual HTTP boundary, before ANY suspension.
@MainActor
private final class ObservedSocketHTTP: ServiceRegistrationHTTP {
    let driver: ServiceRegistrationURLSessionHTTP
    let memory: HTTPMemory
    let origin: URL
    var methods: [String] = []
    var responseSizes: [Int] = []
    var puts: [(String, Int)] = [] // Synthetic only; never printed/persisted.
    init(driver: ServiceRegistrationURLSessionHTTP, memory: HTTPMemory, origin: URL) {
        self.driver = driver
        self.memory = memory
        self.origin = origin
    }
    func send(_ request: ServiceRegistrationRequest) async throws -> ServiceRegistrationResponse {
        guard let bytes = memory.bytes,
              let record = try? JSONDecoder().decode(ServiceExperimentRecoveryRecord.self, from: bytes),
              record.origin == origin,
              request.headers["X-Service-Activity-Secret"] == record.capability,
              request.path == "/public/service_activity_registrations/\(record.registrationID.uuidString.lowercased())" ||
              request.path == "/public/service_activity_registrations/\(record.registrationID.uuidString.lowercased())/revoke",
              try driver.prepare(request).url?.host == origin.host,
              try driver.prepare(request).url?.port == origin.port else {
            throw HarnessFailure(label: "stage/origin before actual HTTP")
        }
        methods.append(request.method)
        if request.method == "PUT", let body = request.body,
           let object = try JSONSerialization.jsonObject(with: body) as? [String: Any],
           let token = object["push_token"] as? String, let version = object["token_version"] as? Int {
            puts.append((token, version))
        }
        let response = try await driver.send(request)
        responseSizes.append(response.body.count)
        guard response.body.count <= 4096 else { throw HarnessFailure(label: "response escaped byte bound") }
        return response
    }
}

@main
@MainActor
private struct RealHTTPHarness {
    static var checks = 0
    static var phase = "arguments"
    static let capability = String(repeating: "synthetic-capability_", count: 3)
    static let activity = "synthetic-memory-only-not-ActivityKit"
    static func check(_ value: Bool, _ label: String) throws {
        guard value else { throw HarnessFailure(label: label) }
        checks += 1
    }
    static func identity() -> ServicePublicationIdentity {
        ServicePublicationIdentity(serviceID: 42, generation: UUID().uuidString.lowercased())
    }
    static func fixtureID(_ alias: Int) -> UUID {
        UUID(uuidString: String(format: "00000000-0000-4000-8000-%012d", alias))!
    }
    static func fixture(_ origin: URL, id: UUID) throws -> (HTTPMemory, ServiceExperimentJournal, ServiceExperimentRecoveryRecord, ObservedSocketHTTP, ServiceRegistrationTransport, ServiceRegistrationFollow) {
        let memory = HTTPMemory()
        let journal = try ServiceExperimentJournal(storage: memory, enabled: true, simulatorFixtureOrigin: origin)
        let record = try journal.stage(origin: origin, identity: identity(), activityID: activity,
            capability: capability, registrationID: id, consented: true)
        let driver = try ServiceRegistrationURLSessionHTTP(baseURL: origin, enabled: true, simulatorFixture: true)
        let http = ObservedSocketHTTP(driver: driver, memory: memory, origin: origin)
        let transport = ServiceRegistrationTransport(enabled: true, http: http)
        let follow = try transport.begin(identity: record.identity, activityID: record.activityID,
            capability: record.capability, id: record.registrationID)
        return (memory, journal, record, http, transport, follow)
    }
    static func registrationError(_ error: Error) -> String {
        switch error {
        case ServiceRegistrationFailure.invalidReceipt: return "receipt"
        case ServiceRegistrationFailure.transport: return "transport"
        case ServiceRegistrationFailure.rejected(let status): return "status-\(status)"
        case ServiceRegistrationFailure.pendingReplacement: return "replacement"
        case ServiceRegistrationFailure.staleFollow: return "stale"
        default: return "unexpected"
        }
    }
    static func rejected(_ expected: String, _ body: () async throws -> Void) async throws {
        do { try await body() }
        catch {
            try check(registrationError(error) == expected, "expected \(expected) received \(registrationError(error))")
            return
        }
        throw HarnessFailure(label: "accepted expected \(expected) rejection")
    }
    static func policies(_ origin: URL) async throws {
        phase = "policy"
        do {
            _ = try ServiceRegistrationURLSessionHTTP(baseURL: origin, enabled: true)
            throw HarnessFailure(label: "default registration admitted HTTP")
        } catch ServiceRegistrationFailure.invalidInput { checks += 1 }
        do {
            _ = try ServicePublicSelectionURLSessionHTTP(baseURL: origin, enabled: true)
            throw HarnessFailure(label: "default public driver admitted HTTP")
        } catch ServicePublicSelectionFailure.invalidInput { checks += 1 }
        for text in ["http://localhost:18778", "http://127.0.0.2:18778", "http://[::1]:18778",
                     "http://127.0.0.1", "http://127.0.0.1:0", "http://127.0.0.1:65536",
                     "http://127.0.0.1:18778/", "http://127.0.0.1:18778/path",
                     "http://127.0.0.1:18778?q=1", "http://user@127.0.0.1:18778"] {
            let bad = URL(string: text)!
            try check(!ServiceRemoteExperimentConfiguration.admitsLoopbackHTTP(bad), "bare loopback admission")
            do {
                _ = try ServiceRegistrationURLSessionHTTP(baseURL: bad, enabled: true, simulatorFixture: true)
                throw HarnessFailure(label: "fixture driver admitted wrong host/port/path")
            } catch ServiceRegistrationFailure.invalidInput { checks += 1 }
            do {
                _ = try ServicePublicSelectionURLSessionHTTP(baseURL: bad, enabled: true, simulatorFixture: true)
                throw HarnessFailure(label: "fixture public driver admitted wrong host/port/path")
            } catch ServicePublicSelectionFailure.invalidInput { checks += 1 }
        }
        let defaults = try ServiceRemoteExperimentConfiguration()
        try check(!defaults.remoteEnabled && !defaults.simulatorFixtureEnabled && !defaults.simulatorHTTPEnabled, "configuration remains default off")
        let defaultJournal = try ServiceExperimentJournal(storage: HTTPMemory(), enabled: true)
        do {
            _ = try defaultJournal.stage(origin: origin, identity: identity(), activityID: activity, capability: capability, consented: true)
            throw HarnessFailure(label: "default journal admitted HTTP")
        } catch ServiceExperimentJournalFailure.invalidRecord { checks += 1 }
        let disabledPublic = try ServicePublicSelectionURLSessionHTTP(baseURL: origin, simulatorFixture: true)
        do { _ = try await disabledPublic.get(serviceID: 42, state: true); throw HarnessFailure(label: "default public read enabled") }
        catch ServicePublicSelectionFailure.disabled { checks += 1 }
        let disabled = try ServiceRegistrationURLSessionHTTP(baseURL: origin, simulatorFixture: true)
        let request = ServiceRegistrationRequest(method: "DELETE",
            path: "/public/service_activity_registrations/\(fixtureID(1).uuidString.lowercased())",
            headers: ["X-Service-Activity-Secret": capability], body: nil)
        do { _ = try await disabled.send(request); throw HarnessFailure(label: "default enabled") }
        catch ServiceRegistrationFailure.disabled { checks += 1 }
        let enabled = try ServiceRegistrationURLSessionHTTP(baseURL: origin, enabled: true, simulatorFixture: true)
        for path in ["/s/42.json", request.path + "/extra", request.path + "?x=1", "http://127.0.0.1:18777" + request.path] {
            do {
                _ = try enabled.prepare(ServiceRegistrationRequest(method: "DELETE", path: path, headers: request.headers, body: nil))
                throw HarnessFailure(label: "unconstrained request path")
            } catch ServiceRegistrationFailure.invalidInput { checks += 1 }
        }
        print("PASS default-off and constrained HTTP policies (no rejected request sent)")
    }
    static func faults(_ origin: URL) async throws {
        // macOS URLSession may surface truncated Content-Length as a normal EOF;
        // the partial JSON must still fail the actual transport's receipt parser.
        let expected = ["receipt", "receipt", "receipt", "transport", "transport", "receipt", "status-307", "status-403", "status-409"]
        for alias in 1...9 {
            phase = "socket fault alias \(alias)"
            let (memory, journal, record, http, transport, follow) = try fixture(origin, id: fixtureID(alias))
            let saved = memory.bytes
            try await rejected(expected[alias - 1]) { _ = try await transport.register(follow, token: "aabb") }
            try check(memory.bytes == saved, "fault retained exact bytes")
            let count = http.methods.count
            try await rejected("replacement") { _ = try await transport.register(follow, token: "ccdd") }
            try check(http.methods.count == count, "ambiguous candidate blocks replacement before socket")
            try journal.requestRemoval(registrationID: record.registrationID)
            try await journal.reconcileRevocation(registrationID: record.registrationID, configuredOrigin: origin, http: http)
            try check(memory.bytes == nil && memory.clears == 1, "fixture valid fence exact erase")
            print("PASS socket fault alias \(alias): \(expected[alias - 1]); pinned candidate; fenced cleanup")
        }
        phase = "exact byte boundary"
        let (boundedMemory, boundedJournal, boundedRecord, boundedHTTP, boundedTransport, boundedFollow) = try fixture(origin, id: fixtureID(12))
        let boundary = try await boundedTransport.register(boundedFollow, token: "aabb")
        try check(boundary.tokenVersion == 1 && boundedHTTP.responseSizes == [4096], "exactly4096 valid receipt admitted")
        try await boundedJournal.reconcileRevocation(registrationID: boundedRecord.registrationID, configuredOrigin: origin, http: boundedHTTP)
        try check(boundedMemory.bytes == nil && boundedMemory.clears == 1, "boundary fixture fence erase")
        print("PASS socket byte boundary: valid4096 accepted; known/chunked4097 rejected")
        phase = "drop after possible PUT"
        let (memory, journal, record, http, transport, follow) = try fixture(origin, id: fixtureID(10))
        let saved = memory.bytes
        let coordinator = ServiceRegistrationCoordinator(transport: transport, follow: follow)
        await coordinator.receive(token: "aabb")
        try check(coordinator.needsRetry && coordinator.failure != nil && http.puts.count == 1, "TCP EOF ambiguity")
        try await rejected("replacement") { _ = try await transport.register(follow, token: "ccdd") }
        await coordinator.retry()
        try check(!coordinator.needsRetry && coordinator.failure == nil, "explicit real socket retry")
        try check(http.puts.count == 2 && http.puts.allSatisfy { $0.0 == "aabb" && $0.1 == 1 }, "exact candidate/version retry")
        try check(memory.bytes == saved, "retry did not rewrite journal")
        coordinator.cancel()
        let count = http.methods.count
        await coordinator.receive(token: "eeff")
        await coordinator.retry()
        try check(http.methods.count == count, "cancel blocks future HTTP")
        try journal.requestRemoval(registrationID: record.registrationID)
        _ = try await transport.remove(follow)
        try await journal.reconcileRevocation(registrationID: record.registrationID, configuredOrigin: origin, http: http)
        try check(memory.bytes == nil && memory.clears == 1, "dropped PUT fence erase")
        print("PASS TCP EOF after possible PUT: exact explicit retry, cancellation, DELETE and fence")

        phase = "invalid fence"
        let (held, fenceJournal, fenceRecord, fenceHTTP, _, _) = try fixture(origin, id: fixtureID(11))
        let exact = held.bytes
        // Wrong namespace must fail BEFORE invoking even this concrete socket driver.
        for wrong in ["http://127.0.0.1:18779", "http://localhost:18778", origin.absoluteString + "/path"] {
            do {
                try await fenceJournal.reconcileRevocation(registrationID: fenceRecord.registrationID,
                    configuredOrigin: URL(string: wrong)!, http: fenceHTTP)
                throw HarnessFailure(label: "wrong journal origin admitted")
            } catch ServiceExperimentJournalFailure.originMismatch { checks += 1 }
        }
        try check(fenceHTTP.methods.isEmpty && held.bytes == exact, "wrong origin no HTTP/exact retention")
        do {
            try await fenceJournal.reconcileRevocation(registrationID: fenceRecord.registrationID, configuredOrigin: origin, http: fenceHTTP)
            throw HarnessFailure(label: "invalid socket fence accepted")
        } catch ServiceExperimentJournalFailure.invalidDeletionReceipt { checks += 1 }
        try check(held.bytes == exact && fenceJournal.pendingRevocation == fenceRecord, "bad fence exact retention")
        do {
            _ = try fenceJournal.stage(origin: origin, identity: identity(), activityID: activity, capability: capability, consented: true)
            throw HarnessFailure(label: "follow bypassed pending fence")
        } catch ServiceExperimentJournalFailure.pendingRecovery { checks += 1 }
        let restored = try ServiceExperimentJournal(storage: held, enabled: true, simulatorFixtureOrigin: origin)
        try check(restored.pendingRevocation == fenceRecord && held.bytes == exact, "memory-only deletion recovery")
        try await restored.reconcileRevocation(registrationID: fenceRecord.registrationID, configuredOrigin: origin, http: fenceHTTP)
        try check(held.bytes == nil && held.clears == 1, "valid socket fence finally erased exact bytes")
        print("PASS invalid fence: exact memory retained, next follow blocked, bound valid fence clears")
    }
    static func real(_ origin: URL) async throws {
        phase = "Rails fixture configuration"
        let configuration = try ServiceRemoteExperimentConfiguration(info: [
            "ServiceProgressRemoteEnabled": true,
            "ServiceProgressDevelopmentOrigin": "https://backend.service-progress.invalid",
            "ServiceProgressDevelopmentReaderOrigin": "https://reader.service-progress.invalid",
            "ServiceProgressSimulatorFixture": true,
            "ServiceProgressSimulatorAPIOrigin": origin.absoluteString,
            "ServiceProgressSimulatorHTTP": true
        ])
        try check(configuration.remoteEnabled && configuration.simulatorFixtureEnabled && configuration.simulatorHTTPEnabled &&
            configuration.simulatorAPIOrigin == origin && configuration.admitsReaderAPI(origin.absoluteString, simulatorAvailable: true),
            "configuration/driver/journal actual origin binding")
        try check(!configuration.admitsReaderAPI("http://127.0.0.1:18779", simulatorAvailable: true), "configuration wrong-port binding")
        phase = "Rails public verifier"
        let publicHTTP = try ServicePublicSelectionURLSessionHTTP(baseURL: origin, enabled: true, simulatorFixture: true)
        let selection = try await ServicePublicSelectionVerifier(http: publicHTTP, enabled: true).verify(serviceID: 42)
        let selected = identity()
        let initial = try selection.publication(identity: selected, now: Date())
        try check(selection.serviceID == 42 && selection.status == "active" && selection.stateRevision >= 0, "real selected public service")
        try check(initial.ordinal == nil && initial.total == nil && initial.occurrenceID == nil && initial.role == nil && initial.contentContext == nil, "real public initial progress unknown")
        try check(initial.expiresAt.timeIntervalSince(initial.updatedAt) == 60, "original freshness budget")
        print("PASS Rails anonymous public verifier: service42 active/coherent revision; initial progress nil")
        phase = "Rails registration alias A"
        // ONE fresh UUID for Rails, not a shared fixed alias. No raw UUID is logged.
        let memory = HTTPMemory()
        let journal = try ServiceExperimentJournal(storage: memory, enabled: true, simulatorFixtureOrigin: origin)
        let record = try journal.stage(origin: origin, identity: selected, activityID: activity,
            capability: capability, registrationID: UUID(), consented: true)
        let driver = try ServiceRegistrationURLSessionHTTP(baseURL: origin, enabled: true, simulatorFixture: true)
        let http = ObservedSocketHTTP(driver: driver, memory: memory, origin: origin)
        let transport = ServiceRegistrationTransport(enabled: true, http: http)
        let follow = try transport.begin(identity: selected, activityID: record.activityID, capability: record.capability, id: record.registrationID)
        let coordinator = ServiceRegistrationCoordinator(transport: transport, follow: follow)
        // Fresh synthetic 32-byte hex per run avoids backend-global token
        // tombstone/uniqueness reuse; these are NOT ActivityKit/APNs tokens.
        let firstToken = (UUID().uuidString + UUID().uuidString).replacingOccurrences(of: "-", with: "").lowercased()
        let rotatedToken = (UUID().uuidString + UUID().uuidString).replacingOccurrences(of: "-", with: "").lowercased()
        do {
            let exact = memory.bytes
            try check(exact != nil && http.methods.isEmpty, "stage before first actual PUT")
            await coordinator.receive(token: firstToken)
            try check(!coordinator.needsRetry && coordinator.failure == nil, "actual coordinator PUT receipt")
            let first = try await transport.register(follow, token: firstToken)
            try check(first.id == record.registrationID && first.tokenVersion == 1, "real idempotent version1 receipt")
            let rotated = try await transport.register(follow, token: rotatedToken)
            try check(rotated.tokenVersion == 2 && rotated.id == first.id, "real same-ID rotation version2")
            try check(http.puts.map { $0.1 } == [1, 1, 2] && memory.bytes == exact, "real version sequence and exact journal")
            coordinator.cancel()
            try journal.requestRemoval(registrationID: record.registrationID)
            let count = http.methods.count
            await coordinator.receive(token: "eeff")
            await coordinator.retry()
            try check(http.methods.count == count, "cancel prevents late observer PUT")
            let removal = try await transport.remove(follow)
            try check(removal == .acknowledged && memory.bytes == exact, "actual DELETE acknowledged but journal retained")
            try await journal.reconcileRevocation(registrationID: record.registrationID, configuredOrigin: origin, http: http)
            try check(memory.bytes == nil && memory.clears == 1 && journal.recoveryRecord == nil, "actual fence exact erase")
            try check(http.methods == ["PUT", "PUT", "PUT", "DELETE", "POST"], "real ordered HTTP methods")
            // A NEW transport lacks local removal knowledge: the actual server,
            // not local stale-follow logic, must reject this late PUT with 409.
            let late = ServiceRegistrationTransport(enabled: true, http: driver)
            let lateFollow = try late.begin(identity: selected, activityID: record.activityID,
                capability: record.capability, id: record.registrationID)
            try await rejected("status-409") { _ = try await late.register(lateFollow, token: firstToken) }
            print("PASS Rails alias A: staged PUT, version1/idempotent, rotation2, cancel, DELETE204, fence200, exact erase, late PUT409")
        } catch {
            coordinator.cancel()
            // Always attempt actual authoritative fence if a failure occurs after
            // staging. Never replace invalid receipts with fabricated success.
            do {
                if journal.recoveryRecord != nil {
                    try journal.requestRemoval(registrationID: record.registrationID)
                    try await journal.reconcileRevocation(registrationID: record.registrationID, configuredOrigin: origin, http: http)
                } else {
                    // Even an unexpectedly accepted post-fence late PUT gets a
                    // second real fence attempt; reuse the SAME subject/ID only.
                    let cleanupMemory = HTTPMemory()
                    let cleanup = try ServiceExperimentJournal(storage: cleanupMemory, enabled: true, simulatorFixtureOrigin: origin)
                    _ = try cleanup.stage(origin: origin, identity: selected, activityID: record.activityID,
                        capability: record.capability, registrationID: record.registrationID, consented: true)
                    try await cleanup.reconcileRevocation(registrationID: record.registrationID, configuredOrigin: origin, http: driver)
                }
                print("PASS Rails alias A failure cleanup: authoritative fence and exact memory erase")
            } catch {
                print("FAIL Rails alias A failure cleanup: fence unresolved (no secrets logged)")
            }
            throw error
        }
    }
    static func main() async {
        do {
            let args = CommandLine.arguments
            // Even direct executable invocation requires an explicit --rails;
            // bare origins alone are never authorization to mutate a backend.
            try check(args.count == 3 || (args.count == 4 && ["--faults-only", "--rails"].contains(args[3])), "bounded arguments")
            try check(args[1] == "http://127.0.0.1:18777" && args[2] == "http://127.0.0.1:18778", "owned explicit origins only")
            let backend = URL(string: args[1])!
            let errors = URL(string: args[2])!
            try await policies(errors)
            try await faults(errors)
            if args.count == 4 && args[3] == "--rails" { try await real(backend) }
            else { print("UNRUN Rails (default/--faults-only; requires explicit --rails)") }
            print("PASS RealHTTPHarness: \(checks) checks; synthetic memory/activity/token only; HTTPS/system trust, ActivityKit, APNs and physical delivery UNRUN")
        } catch {
            if let failure = error as? HarnessFailure {
                print("FAIL \(phase): \(failure.label)")
            } else {
                // Deliberately never interpolate Foundation errors, URLs or bodies.
                print("FAIL \(phase): sanitized \(registrationError(error))")
            }
            exit(1)
        }
    }
}
