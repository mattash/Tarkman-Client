import Foundation

// Direct Codable wire shape of the existing synthetic-only native experiment.
// This is not the future real-service publication contract or Expo props wrapper.
struct ServiceContentState: Codable, Hashable {
    var ordinal: Int
    var occurrenceID: Int
    var role: String // Localization key, synthetic only.
    var updatedAt: Date
    var paused: Bool
}
