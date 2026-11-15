import Foundation

// Versioned direct-Codable contract coordinated with backend Tarkman #552.
// This is deliberately separate from the five-field local fixture ContentState.
// Decoding alone is not authentication, ordering, expiry or semantic validation.
struct ServicePublicationV1: Codable, Hashable {
    let schemaVersion: Int
    let sessionID: Int
    let generation: String
    let sequence: Int
    let stateRevision: Int?
    let contentContext: String?
    let serviceTitle: String?
    let status: String
    let occurrenceID: Int?
    let ordinal: Int?
    let total: Int?
    let role: String?
    let updatedAt: Date
    let expiresAt: Date
}

// Immutable follow identity, including same-service re-follow isolation.
struct ServicePublicationIdentity: Codable, Hashable {
    let serviceID: Int
    let generation: String
    // Optional app-originated public reader origin. Nil preserves the historical
    // fixture wire; dev service IDs must never silently open a production service.
    let readerOrigin: String?

    init(serviceID: Int, generation: String, readerOrigin: String? = nil) {
        self.serviceID = serviceID
        self.generation = generation
        self.readerOrigin = readerOrigin
    }
}
