import Foundation

/// In-memory replies only. Never constructs URLSession, observes APNs or accesses
/// Keychain. The product presenter admits this seam only in a Debug Simulator.
@MainActor
final class ServiceSimulatorFixture: ServicePublicSelectionHTTP, ServiceRegistrationHTTP, ServiceExperimentSecretStorage {
    private var bytes: Data?
    static var available: Bool {
        #if targetEnvironment(simulator) && DEBUG
        return Bundle.main.bundleIdentifier == "app.tarkman.progressprototype"
        #else
        return false
        #endif
    }
    static func make(configuration: ServiceRemoteExperimentConfiguration) -> ServiceSimulatorFixture? {
        guard available, configuration.simulatorFixtureEnabled else { return nil }
        return ServiceSimulatorFixture()
    }

    func load() throws -> Data? { bytes }
    func saveIfAbsent(_ data: Data) throws {
        guard bytes == nil else { throw ServiceExperimentJournalFailure.storage }
        bytes = data
    }
    func removeIfMatching(_ data: Data) throws {
        guard bytes == data else { throw ServiceExperimentJournalFailure.storage }
        bytes = nil
    }
    func get(serviceID: Int, state: Bool) async throws -> ServicePublicSelectionResponse {
        // Only the documented public QA fixtures; not an assertion about arbitrary IDs.
        guard [42, 43, 9001].contains(serviceID) else { throw ServicePublicSelectionFailure.unavailable }
        var session: [String: Any] = ["id": serviceID, "status": "active", "revision": 1]
        if !state { session["liturgy"] = "Simulator public service \(serviceID)" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss 'GMT'"
        return ServicePublicSelectionResponse(status: 200,
            headers: ["Content-Type": "application/json", "Date": formatter.string(from: Date())],
            body: try JSONSerialization.data(withJSONObject: ["session": session]))
    }
    func send(_ request: ServiceRegistrationRequest) async throws -> ServiceRegistrationResponse {
        guard let bytes, let record = try? JSONDecoder().decode(ServiceExperimentRecoveryRecord.self, from: bytes),
              request.headers["X-Service-Activity-Secret"] == record.capability else {
            throw ServiceRegistrationFailure.invalidInput
        }
        let path = "/public/service_activity_registrations/\(record.registrationID.uuidString.lowercased())"
        let headers = ["Cache-Control": "no-store"]
        if request.method == "DELETE", request.path == path, request.body == nil {
            return ServiceRegistrationResponse(status: 204, headers: headers, body: Data())
        }
        guard let data = request.body,
              let body = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              body["session_id"] as? Int == record.identity.serviceID,
              body["activity_id"] as? String == record.activityID,
              body["generation"] as? String == record.identity.generation else {
            throw ServiceRegistrationFailure.invalidInput
        }
        let response: [String: Any]
        if request.method == "POST", request.path == path + "/revoke" {
            response = ["id": record.registrationID.uuidString.lowercased(), "session_id": record.identity.serviceID,
                "activity_id": record.activityID, "generation": record.identity.generation, "revoked": true]
        } else if request.method == "PUT", request.path == path,
                  body["push_token"] as? String == "aabb", let version = body["token_version"] as? Int,
                  version > 0, let lease = body["lease_seconds"] as? Int, (60...3600).contains(lease) {
            response = ["id": record.registrationID.uuidString.lowercased(), "token_version": version,
                "lease_expires_at": ISO8601DateFormatter().string(from: Date().addingTimeInterval(Double(lease - 1)))]
        } else { throw ServiceRegistrationFailure.invalidInput }
        return ServiceRegistrationResponse(status: 200, headers: headers,
            body: try JSONSerialization.data(withJSONObject: response, options: [.sortedKeys]))
    }
}
