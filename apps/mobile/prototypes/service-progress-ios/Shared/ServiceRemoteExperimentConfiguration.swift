import Foundation
import CoreFoundation

/// Build-time development seam, not consent or permission to start an Activity.
/// No endpoint is shipped. The caller must separately obtain fresh disclosure,
/// selection, follow identity and capability, and check native authorization.
struct ServiceRemoteExperimentConfiguration {
    let remoteEnabled: Bool
    let developmentOrigin: URL?
    let developmentReaderOrigin: URL?
    let simulatorFixtureEnabled: Bool
    let simulatorAPIOrigin: URL?
    let simulatorHTTPEnabled: Bool

    enum Failure: Error { case invalidConfiguration }

    init(info: [String: Any] = [:]) throws {
        if let value = info["ServiceProgressRemoteEnabled"] {
            guard let number = value as? NSNumber,
                  CFGetTypeID(number) == CFBooleanGetTypeID() else {
                throw Failure.invalidConfiguration
            }
            remoteEnabled = number.boolValue
        } else {
            remoteEnabled = false
        }
        if let value = info["ServiceProgressDevelopmentOrigin"] {
            guard let text = value as? String,
                  text == text.trimmingCharacters(in: .whitespacesAndNewlines),
                  let origin = Self.explicitHTTPSOrigin(text) else {
                throw Failure.invalidConfiguration
            }
            developmentOrigin = origin
        } else {
            developmentOrigin = nil
        }
        if let value = info["ServiceProgressDevelopmentReaderOrigin"] {
            guard let text = value as? String,
                  text == text.trimmingCharacters(in: .whitespacesAndNewlines),
                  let origin = Self.explicitHTTPSOrigin(text) else {
                throw Failure.invalidConfiguration
            }
            developmentReaderOrigin = origin
        } else {
            developmentReaderOrigin = nil
        }
        if let value = info["ServiceProgressSimulatorFixture"] {
            guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else {
                throw Failure.invalidConfiguration
            }
            simulatorFixtureEnabled = number.boolValue
        } else { simulatorFixtureEnabled = false }
        if let value = info["ServiceProgressSimulatorAPIOrigin"] {
            guard let text = value as? String, let origin = Self.explicitSimulatorOrigin(text) else {
                throw Failure.invalidConfiguration
            }
            simulatorAPIOrigin = origin
        } else { simulatorAPIOrigin = nil }
        if let value = info["ServiceProgressSimulatorHTTP"] {
            guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else {
                throw Failure.invalidConfiguration
            }
            simulatorHTTPEnabled = number.boolValue
        } else { simulatorHTTPEnabled = false }
        guard !simulatorHTTPEnabled || simulatorFixtureEnabled else { throw Failure.invalidConfiguration }
        guard !simulatorFixtureEnabled || (remoteEnabled && simulatorAPIOrigin != nil &&
            developmentOrigin?.absoluteString == "https://backend.service-progress.invalid" &&
            developmentReaderOrigin?.absoluteString == "https://reader.service-progress.invalid") else {
            throw Failure.invalidConfiguration
        }
        // Backend IDs are scoped to that backend. An explicit trusted frontend
        // origin prevents a development selection from opening a production ID.
        guard !remoteEnabled || (developmentOrigin != nil && developmentReaderOrigin != nil) else {
            throw Failure.invalidConfiguration
        }
    }

    func admitsReaderAPI(_ text: String, simulatorAvailable: Bool = false) -> Bool {
        if simulatorFixtureEnabled {
            return simulatorAvailable && Self.explicitSimulatorOrigin(text) == simulatorAPIOrigin
        }
        guard let origin = Self.explicitHTTPSOrigin(text), let trusted = developmentOrigin,
              let first = URLComponents(url: origin, resolvingAgainstBaseURL: false),
              let second = URLComponents(url: trusted, resolvingAgainstBaseURL: false) else { return false }
        return first.host?.lowercased() == second.host?.lowercased() && (first.port ?? 443) == (second.port ?? 443)
    }

    /// Socket testing only, never a relaxed HTTPS/trust policy for real callers.
    /// The separate Mac executable must opt in at compile time; that define cannot
    /// admit an iOS device or Release app. No TLS challenge override is installed.
    static func admitsLoopbackHTTP(_ url: URL) -> Bool {
        #if os(macOS) && SERVICE_PROGRESS_HTTP_TESTING
        return explicitSimulatorOrigin(url.absoluteString) == url
        #elseif DEBUG && targetEnvironment(simulator)
        return Bundle.main.bundleIdentifier == "app.tarkman.progressprototype" &&
            explicitSimulatorOrigin(url.absoluteString) == url
        #else
        return false
        #endif
    }

    static func explicitSimulatorOrigin(_ text: String) -> URL? {
        guard text.range(of: #"^http://127\.0\.0\.1:[1-9][0-9]{0,4}$"#, options: .regularExpression) != nil,
              let parts = URLComponents(string: text), parts.scheme == "http", parts.host == "127.0.0.1",
              let port = parts.port, (1...65535).contains(port), parts.user == nil, parts.password == nil,
              parts.path.isEmpty, parts.query == nil, parts.fragment == nil,
              let url = parts.url, url.absoluteString == text else { return nil }
        return url
    }

    /// A bare origin only. Even a trailing slash is intentionally rejected;
    /// the caller supplies trust out of band, never through a reader deep link.
    static func explicitHTTPSOrigin(_ text: String) -> URL? {
        guard let parts = URLComponents(string: text), parts.scheme == "https",
              let host = parts.host, !host.isEmpty,
              parts.user == nil, parts.password == nil, parts.query == nil,
              parts.fragment == nil, parts.path.isEmpty,
              parts.port == nil || (1...65535).contains(parts.port!),
              let url = parts.url, url.absoluteString == text else { return nil }
        return url
    }
}
