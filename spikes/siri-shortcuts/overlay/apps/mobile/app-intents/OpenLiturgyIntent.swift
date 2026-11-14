import AppIntents
import Foundation
internal import ExpoAppIntents

/// Opening only: no entity catalog, indexing, donations, or playback controls.
struct OpenLiturgyIntent: AppIntent {
  static let title: LocalizedStringResource = "Open Liturgy"
  static let openAppWhenRun: Bool = true

  @Parameter(title: "Liturgy ID")
  var liturgyId: String

  static var parameterSummary: some ParameterSummary {
    Summary("Open liturgy \(\.$liturgyId)")
  }

  @MainActor
  func perform() async throws -> some IntentResult {
    guard isCanonicalLiturgyId(liturgyId) else {
      throw InvalidLiturgyId()
    }

    await AppIntentDispatcher.shared.dispatch(
      name: "openLiturgy",
      params: ["liturgyId": .string(liturgyId)]
    )
    // Dispatch only queues an opening request; it does not confirm that the liturgy exists.
    return .result()
  }
}

/// Keep the identifier as text end-to-end; reject coercion, leading zeros, and unsafe JS IDs.
func isCanonicalLiturgyId(_ value: String) -> Bool {
  let bytes = Array(value.utf8)
  guard let first = bytes.first, first >= 49, first <= 57,
        bytes.allSatisfy({ $0 >= 48 && $0 <= 57 }),
        let number = UInt64(value), number <= 9_007_199_254_740_991 else {
    return false
  }
  return true
}

private struct InvalidLiturgyId: LocalizedError {
  var errorDescription: String? {
    "Enter a positive liturgy ID without leading zeros, up to 9007199254740991."
  }
}
