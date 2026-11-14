import Foundation

/// Isolated-spike breadcrumbs only. Never store the resolved parameter or reader content.
/// All native and JS writes share the main actor; persistence is best-effort, not an outcome.
@MainActor
enum SiriSpikeDiagnostics {
  static let storageKey = "app.tarkman.sirispike.diagnostics.events"
  private static let capacity = 32

  enum NativeStage: String {
    case performEntered = "native:perform-entered"
    case validationAccepted = "native:validation-accepted"
    case validationRejected = "native:validation-rejected"
    case dispatchReturned = "native:dispatch-returned"
    case runtimeCreated = "native:runtime-created"
  }

  enum InputClassification: String, Codable {
    case exactOne = "exact-one"
    case englishWordOne = "english-word-one"
    case otherCanonical = "other-canonical"
    case invalid
  }

  private struct Event: Codable {
    let stage: String
    let timestamp: Double
    let bundleIdentifier: String
    let processIdentifier: Int32
    let processName: String
    let invocationId: String?
    let inputClassification: InputClassification?
    let inputUTF8ByteCount: Int?
  }

  private static let jsStages: Set<String> = [
    "module:available", "module:unavailable", "root:waiting", "root:ready",
    "queue:received", "route:accepted", "ack:ok", "handler:error",
  ]

  static func classify(_ value: String) -> InputClassification {
    if value == "1" { return .exactOne }
    if value.lowercased() == "one" { return .englishWordOne } // Classification only; validation never coerces it.
    return isCanonicalLiturgyId(value) ? .otherCanonical : .invalid
  }

  static func record(_ stage: NativeStage, input: String? = nil, invocationId: String? = nil) {
    append(
      stage: stage.rawValue,
      invocationId: invocationId,
      classification: input.map { classify($0) },
      byteCount: input.map { $0.utf8.count }
    )
  }

  /// No arbitrary JS text enters the store: fixed stages and an optional UUID only.
  static func recordJS(stage: String, invocationId: String) {
    guard stage.utf8.count <= 32, jsStages.contains(stage),
          invocationId.isEmpty || (invocationId.utf8.count == 36 && UUID(uuidString: invocationId) != nil) else {
      return
    }
    append(stage: stage, invocationId: invocationId.isEmpty ? nil : invocationId)
  }

  private static func append(
    stage: String,
    invocationId: String?,
    classification: InputClassification? = nil,
    byteCount: Int? = nil
  ) {
    let defaults = UserDefaults.standard
    let previous = defaults.data(forKey: storageKey)
      .flatMap { try? JSONDecoder().decode([Event].self, from: $0) } ?? []
    var events = Array(previous.suffix(capacity - 1))
    events.append(Event(
      stage: stage,
      timestamp: Date().timeIntervalSince1970 * 1000,
      bundleIdentifier: String((Bundle.main.bundleIdentifier ?? "unknown").prefix(128)),
      processIdentifier: ProcessInfo.processInfo.processIdentifier,
      processName: String(ProcessInfo.processInfo.processName.prefix(128)),
      invocationId: invocationId,
      inputClassification: classification,
      inputUTF8ByteCount: byteCount
    ))
    guard let data = try? JSONEncoder().encode(events) else { return }
    defaults.set(data, forKey: storageKey)
  }
}
