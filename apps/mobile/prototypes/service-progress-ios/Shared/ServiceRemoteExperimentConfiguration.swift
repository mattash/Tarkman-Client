import Foundation
import CoreFoundation

/// Build-time development seam, not consent or permission to start an Activity.
/// No endpoint is shipped. The caller must separately obtain fresh disclosure,
/// selection, follow identity and capability, and check native authorization.
struct ServiceRemoteExperimentConfiguration {
    let remoteEnabled: Bool
    let developmentOrigin: URL?
    let developmentReaderOrigin: URL?

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
        // Backend IDs are scoped to that backend. An explicit trusted frontend
        // origin prevents a development selection from opening a production ID.
        guard !remoteEnabled || (developmentOrigin != nil && developmentReaderOrigin != nil) else {
            throw Failure.invalidConfiguration
        }
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
