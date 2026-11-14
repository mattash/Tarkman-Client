#if canImport(Security)
import Foundation
import Security

// App target ONLY; never add to the Widget extension. No shared access group,
// synchronizable item, production identifier, defaults or filesystem fallback.
@MainActor
final class ServiceExperimentKeychain: ServiceExperimentSecretStorage,
    CustomStringConvertible, CustomDebugStringConvertible {
    private static let bundleID = "app.tarkman.progressprototype"
    private static let service = "app.tarkman.progressprototype.experiment-recovery.v1"
    private static let account = "app.tarkman.progressprototype.pending-registration"
    nonisolated var description: String { "ServiceExperimentKeychain([redacted])" }
    nonisolated var debugDescription: String { description }

    // Construction does not access Keychain. Every operation checks app isolation.
    init() {}

    static func freshCapability() throws -> String {
        try requireIsolatedApp()
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw ServiceExperimentJournalFailure.storage
        }
        return Data(bytes).base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    func load() throws -> Data? {
        try Self.requireIsolatedApp()
        var query = Self.query()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else {
            throw ServiceExperimentJournalFailure.storage
        }
        return data
    }

    func saveIfAbsent(_ data: Data) throws {
        try Self.requireIsolatedApp()
        var query = Self.query()
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        // SecItemAdd fails on duplicates: never update/overwrite pending recovery.
        guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else {
            throw ServiceExperimentJournalFailure.storage
        }
    }

    func removeIfMatching(_ data: Data) throws {
        try Self.requireIsolatedApp()
        // Synchronous MainActor compare/delete: no suspension or in-process writer
        // can replace the item between these operations; no shared app group exists.
        guard try load() == data else { throw ServiceExperimentJournalFailure.storage }
        guard SecItemDelete(Self.query() as CFDictionary) == errSecSuccess else {
            throw ServiceExperimentJournalFailure.storage
        }
    }

    private static func query() -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service, kSecAttrAccount as String: account,
         kSecAttrSynchronizable as String: false,
         kSecUseDataProtectionKeychain as String: true]
    }

    private static func requireIsolatedApp() throws {
        guard Bundle.main.bundleIdentifier == bundleID,
              Bundle.main.bundleURL.pathExtension != "appex" else {
            throw ServiceExperimentJournalFailure.disabled
        }
    }
}
#endif
