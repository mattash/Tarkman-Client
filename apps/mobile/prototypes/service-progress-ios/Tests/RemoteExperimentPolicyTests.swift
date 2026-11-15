import Foundation

@main
struct RemoteExperimentPolicyTests {
    static func reject(_ info: [String: Any]) {
        do { _ = try ServiceRemoteExperimentConfiguration(info: info); fatalError("accepted invalid configuration") }
        catch {}
    }

    static func main() throws {
        let defaults = try ServiceRemoteExperimentConfiguration()
        precondition(!defaults.remoteEnabled && defaults.developmentOrigin == nil && defaults.developmentReaderOrigin == nil)
        let disabled = try ServiceRemoteExperimentConfiguration(info: ["ServiceProgressRemoteEnabled": false])
        precondition(!disabled.remoteEnabled)
        let optedIn = try ServiceRemoteExperimentConfiguration(info: [
            "ServiceProgressRemoteEnabled": true,
            "ServiceProgressDevelopmentOrigin": "https://experiment.invalid:8443",
            "ServiceProgressDevelopmentReaderOrigin": "https://reader-experiment.invalid:9443",
        ])
        precondition(optedIn.remoteEnabled && optedIn.developmentOrigin?.host == "experiment.invalid")
        precondition(optedIn.developmentReaderOrigin?.absoluteString == "https://reader-experiment.invalid:9443")
        reject(["ServiceProgressRemoteEnabled": true])
        reject(["ServiceProgressRemoteEnabled": true, "ServiceProgressDevelopmentOrigin": "https://experiment.invalid"])
        reject(["ServiceProgressRemoteEnabled": true, "ServiceProgressDevelopmentReaderOrigin": "https://reader-experiment.invalid"])
        let configuredButDisabled = try ServiceRemoteExperimentConfiguration(info: [
            "ServiceProgressDevelopmentOrigin": "https://experiment.invalid",
            "ServiceProgressDevelopmentReaderOrigin": "https://reader-experiment.invalid",
        ])
        precondition(!configuredButDisabled.remoteEnabled)
        precondition(configuredButDisabled.developmentReaderOrigin != nil)
        for value: Any in ["true", "YES", 1, 0, NSNull()] { reject(["ServiceProgressRemoteEnabled": value]) }
        for origin in ["http://experiment.invalid", "https://experiment.invalid/", "https://experiment.invalid/path",
                       "https://user:pass@experiment.invalid", "https://experiment.invalid?token=x",
                       "https://experiment.invalid#x", "https://experiment.invalid?", "https://experiment.invalid#",
                       " https://experiment.invalid", "https://experiment.invalid\n", "", "//experiment.invalid",
                       "https://experiment.invalid:0", "https://experiment.invalid:65536"] {
            reject(["ServiceProgressDevelopmentOrigin": origin])
            reject(["ServiceProgressDevelopmentReaderOrigin": origin])
            reject(["ServiceProgressRemoteEnabled": true,
                    "ServiceProgressDevelopmentOrigin": "https://experiment.invalid",
                    "ServiceProgressDevelopmentReaderOrigin": origin])
        }
        reject(["ServiceProgressDevelopmentOrigin": 123])
        reject(["ServiceProgressDevelopmentReaderOrigin": 123])
        print("Remote experiment policy tests passed (synthetic configuration; no I/O)")
    }
}
