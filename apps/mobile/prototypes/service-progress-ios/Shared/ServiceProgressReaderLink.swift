import CoreFoundation
import Foundation

/// Only the explicitly flagged Debug Simulator variant substitutes its own QA
/// scheme, so the read-only tap can be exercised without real web/backend access.
/// Every device/default build retains the validated HTTPS reader destination.
enum ServiceProgressReaderLink {
    static func url(_ validatedURL: URL?, info: [String: Any] = Bundle.main.infoDictionary ?? [:]) -> URL? {
        guard let validatedURL else { return nil }
        #if targetEnvironment(simulator) && DEBUG
        if let flag = info["ServiceProgressSimulatorFixture"] as? NSNumber,
           CFGetTypeID(flag) == CFBooleanGetTypeID(), flag.boolValue,
           info["ServiceProgressSimulatorTapScheme"] as? String == "tarkman-progress-dev",
           validatedURL.scheme == "https", validatedURL.host == "reader.service-progress.invalid",
           validatedURL.user == nil, validatedURL.password == nil,
           validatedURL.query == nil, validatedURL.fragment == nil,
           validatedURL.path.range(of: #"^/sessions/[1-9][0-9]*/parts$"#, options: .regularExpression) != nil {
            return URL(string: "tarkman-progress-dev://" + validatedURL.path)
        }
        #endif
        return validatedURL
    }
}
