import Foundation

// Host-only fake/policy checks. No ActivityKit, Keychain, URLSession or APNs run.
@main
@MainActor
private struct ProductSimulatorPolicyTests {
    static var checks = 0
    static func check(_ value: Bool) { precondition(value); checks += 1 }
    static func main() async throws {
        let info: [String: Any] = ["ServiceProgressRemoteEnabled": true,
            "ServiceProgressDevelopmentOrigin": "https://backend.service-progress.invalid",
            "ServiceProgressDevelopmentReaderOrigin": "https://reader.service-progress.invalid",
            "ServiceProgressSimulatorFixture": true,
            "ServiceProgressSimulatorAPIOrigin": "http://127.0.0.1:8140"]
        let configuration = try ServiceRemoteExperimentConfiguration(info: info)
        check(!ServiceSimulatorFixture.available)
        check(ServiceSimulatorFixture.make(configuration: configuration) == nil)
        check(!configuration.admitsReaderAPI("http://127.0.0.1:8140"))
        check(configuration.admitsReaderAPI("http://127.0.0.1:8140", simulatorAvailable: true))
        for invalid in ["http://localhost:8140", "http://127.0.0.1:08140", "http://127.0.0.1:0",
                        "http://127.0.0.1:65536", "http://127.0.0.1:8140/", "http://127.0.0.1:8140?",
                        "http://127.0.0.1:8140#", "http://x@127.0.0.1:8140", "http://127.0.0.1:8140\n"] {
            check(ServiceRemoteExperimentConfiguration.explicitSimulatorOrigin(invalid) == nil)
            check(!configuration.admitsReaderAPI(invalid, simulatorAvailable: true))
        }
        var malformed = info
        malformed["ServiceProgressSimulatorFixture"] = 1
        do { _ = try ServiceRemoteExperimentConfiguration(info: malformed); preconditionFailure("Coerced mode") }
        catch ServiceRemoteExperimentConfiguration.Failure.invalidConfiguration { checks += 1 }
        malformed = info
        malformed["ServiceProgressDevelopmentOrigin"] = "https://another.invalid"
        do { _ = try ServiceRemoteExperimentConfiguration(info: malformed); preconditionFailure("Unsealed fake origin") }
        catch ServiceRemoteExperimentConfiguration.Failure.invalidConfiguration { checks += 1 }
        let disabled = try ServiceRemoteExperimentConfiguration()
        check(!disabled.remoteEnabled && !disabled.simulatorFixtureEnabled)

        let fixture = ServiceSimulatorFixture()
        let selected = try await ServicePublicSelectionVerifier(http: fixture, enabled: true).verify(serviceID: 42)
        check(selected.serviceID == 42 && selected.title == "Simulator public service 42")
        do { _ = try await fixture.get(serviceID: 99, state: true); preconditionFailure("Unlisted fake service") }
        catch ServicePublicSelectionFailure.unavailable { checks += 1 }
        let identity = ServicePublicationIdentity(serviceID: 42, generation: UUID().uuidString.lowercased(),
            readerOrigin: "https://reader.service-progress.invalid")
        let publication = try selected.publication(identity: identity, now: Date())
        check(publication.ordinal == nil && publication.total == nil && publication.role == nil)
        check(publication.expiresAt.timeIntervalSince(publication.updatedAt) == 60)
        let tap = ServicePublicationValidator.presentation(publication, identity: identity, now: Date()).tapURL
        check(tap?.absoluteString == "https://reader.service-progress.invalid/sessions/42/parts")
        // Even explicit fake metadata cannot substitute a QA scheme on this Mac.
        check(ServiceProgressReaderLink.url(tap, info: ["ServiceProgressSimulatorFixture": true,
            "ServiceProgressSimulatorTapScheme": "tarkman-progress-dev"]) == tap)

        let journal = try ServiceExperimentJournal(storage: fixture, enabled: true)
        let record = try journal.stage(origin: URL(string: "https://backend.service-progress.invalid")!,
            identity: identity, activityID: "simulator-policy-not-an-ActivityKit-id",
            capability: String(repeating: "x", count: 64), consented: true)
        let transport = ServiceRegistrationTransport(enabled: true, http: fixture)
        let follow = try transport.begin(identity: identity, activityID: record.activityID,
            capability: record.capability, id: record.registrationID)
        let receipt = try await transport.register(follow, token: "aabb")
        check(receipt.id == record.registrationID && receipt.tokenVersion == 1)
        try journal.requestRemoval(registrationID: record.registrationID)
        check(try await transport.remove(follow) == .acknowledged)
        try await journal.reconcileRevocation(registrationID: record.registrationID,
            configuredOrigin: record.origin, http: fixture)
        let cleared = try fixture.load()
        check(journal.recoveryRecord == nil && cleared == nil)
        print("Product Simulator policy: \(checks) checks passed; in-memory only, no ActivityKit/network/Keychain")
    }
}
