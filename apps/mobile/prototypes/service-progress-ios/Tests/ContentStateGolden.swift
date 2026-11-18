import Foundation

// Compile with Shared/ServiceContentState.swift; no ActivityKit, device or credentials.
@main
struct ContentStateGolden {
    static func main() throws {
        guard CommandLine.arguments.count == 2 else {
            fatalError("Usage: content-state-golden <golden-update.json>")
        }
        let fixture = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
        let root = try JSONSerialization.jsonObject(with: fixture) as! [String: Any]
        let aps = root["aps"] as! [String: Any]
        let timestamp = (aps["timestamp"] as! NSNumber).doubleValue
        let staleDate = (aps["stale-date"] as! NSNumber).doubleValue
        precondition(timestamp == 1_700_000_000 && staleDate == timestamp + 60)
        precondition(aps["event"] as? String == "update")
        let stateData = try JSONSerialization.data(withJSONObject: aps["content-state"]!)
        // This is the exact type aliased as ServiceAttributes.ContentState in the app/extension.
        let expected = ServiceContentState(ordinal: 1, occurrenceID: 11, role: "reader",
                                          updatedAt: Date(timeIntervalSince1970: timestamp), paused: false)
        let decoded = try JSONDecoder().decode(ServiceContentState.self, from: stateData)
        precondition(decoded == expected, "Provider fixture must decode into the actual native state")
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let encoded = try encoder.encode(expected)
        let nativeObject = try JSONSerialization.jsonObject(with: encoded) as! NSDictionary
        let fixtureObject = try JSONSerialization.jsonObject(with: stateData) as! NSDictionary
        precondition(nativeObject == fixtureObject, "Provider fields must match compiled Codable encoding")
        precondition((nativeObject["updatedAt"] as! NSNumber).doubleValue == 721_692_800,
                     "Default Codable Date is seconds since 2001, not Unix seconds or milliseconds")
        precondition(fixture.count < 4096, "Golden APNs payload must fit 4 KB")
        // Missing required native fields must not accidentally look like a valid publication.
        do {
            _ = try JSONDecoder().decode(ServiceContentState.self, from: Data("{}".utf8))
            fatalError("Missing required content-state fields decoded")
        } catch DecodingError.keyNotFound { }
        print("Synthetic native golden verified: \(String(decoding: encoded, as: UTF8.self))")
        print("APNs envelope uses Unix seconds; native Date uses reference-date seconds; payload \(fixture.count) bytes")
    }
}
