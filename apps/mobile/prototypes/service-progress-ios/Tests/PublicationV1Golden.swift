import Foundation

@main
struct PublicationV1Golden {
    static func main() throws {
        guard CommandLine.arguments.count == 2 else {
            fatalError("Usage: publication-v1-golden <fixtures-directory>")
        }
        let directory = URL(fileURLWithPath: CommandLine.arguments[1])
        let identity = ServicePublicationIdentity(serviceID: 42, generation: "11111111-2222-4333-8444-555555555555")
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let decoder = JSONDecoder()
        let identityFixture = try Data(contentsOf: directory.appendingPathComponent("publication-v1-attributes.json"))
        let decodedIdentity = try decoder.decode(ServicePublicationIdentity.self, from: identityFixture)
        precondition(decodedIdentity == identity)
        func state(_ sequence: Int, _ status: String, revision: Int? = 7, context: String? = nil,
                   title: String? = "SYNTHETIC PUBLIC SERVICE 42", occurrence: Int? = nil,
                   ordinal: Int? = nil, total: Int? = nil, role: String? = nil) -> ServicePublicationV1 {
            ServicePublicationV1(schemaVersion: 1, sessionID: identity.serviceID, generation: identity.generation,
                                 sequence: sequence, stateRevision: revision, contentContext: context,
                                 serviceTitle: title, status: status, occurrenceID: occurrence,
                                 ordinal: ordinal, total: total, role: role,
                                 updatedAt: Date(timeIntervalSince1970: 1_700_000_000),
                                 expiresAt: Date(timeIntervalSince1970: 1_700_000_060))
        }
        let cases: [(String, ServicePublicationV1)] = [
            ("active", state(1, "active", context: "synthetic-v1", occurrence: 12, ordinal: 2, total: 3, role: "choir")),
            ("unknown", state(2, "paused")),
            ("empty", state(3, "active", context: "synthetic-empty-v1", total: 0)),
            ("deleted", state(4, "deleted", revision: nil, title: nil))
        ]
        for (name, expected) in cases {
            let data = try Data(contentsOf: directory.appendingPathComponent("publication-v1-\(name).json"))
            let root = try JSONSerialization.jsonObject(with: data) as! [String: Any]
            let aps = root["aps"] as! [String: Any]
            precondition((aps["timestamp"] as! NSNumber).doubleValue == expected.updatedAt.timeIntervalSince1970)
            precondition((aps["stale-date"] as! NSNumber).doubleValue == expected.expiresAt.timeIntervalSince1970)
            precondition(aps["event"] as? String == (name == "deleted" ? "end" : "update"))
            if name == "deleted" {
                precondition((aps["dismissal-date"] as! NSNumber).doubleValue == expected.updatedAt.timeIntervalSince1970 - 1)
            }
            let stateData = try JSONSerialization.data(withJSONObject: aps["content-state"]!)
            let decodedState = try decoder.decode(ServicePublicationV1.self, from: stateData)
            precondition(decodedState == expected)
            let native = try JSONSerialization.jsonObject(with: encoder.encode(expected)) as! NSDictionary
            let fixture = try JSONSerialization.jsonObject(with: stateData) as! NSDictionary
            precondition(native == fixture, "Compiled native fields must exactly match provider fixture")
            precondition(expected.sessionID == identity.serviceID && expected.generation == identity.generation)
            // Nil optionals encode as absent; null remains accepted as unknown on decode.
            if expected.total == nil {
                precondition(native["total"] == nil)
                var explicitNull = fixture as! [String: Any]
                explicitNull["total"] = NSNull()
                let withNull = try JSONSerialization.data(withJSONObject: explicitNull)
                let decodedNull = try decoder.decode(ServicePublicationV1.self, from: withNull)
                precondition(decodedNull == expected)
            }
            precondition(data.count + identityFixture.count < 4096, "Bounded synthetic payload and attributes")
            print("PUBLICATION_V1_GOLDEN \(name) verified (\(data.count) envelope bytes)")
        }
        // Codable types reject missing required identity/version/ordering fields.
        do {
            _ = try decoder.decode(ServicePublicationV1.self, from: Data("{}".utf8))
            fatalError("Required publication fields decoded as absent")
        } catch DecodingError.keyNotFound { }
        print("Wire encoding only: no authentication, sequencing enforcement, renderer or APNs delivery claimed")
    }
}
