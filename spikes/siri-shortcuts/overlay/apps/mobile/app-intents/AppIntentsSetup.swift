internal import ExpoAppIntents
internal import ExpoModulesCore

/// Registered Expo inline module that wires app-target App Intents code to expo-app-intents.
/// Do not change the name of this class.
final class AppIntentsSetup: Module {
  public func definition() -> ExpoModulesCore.ModuleDefinition {
    Name("AppIntentsSetup")

    AsyncFunction("recordDiagnostic") { (stage: String, invocationId: String) async in
      await SiriSpikeDiagnostics.recordJS(stage: stage, invocationId: invocationId)
    }

    OnCreate {
      Task { @MainActor in
        SiriSpikeDiagnostics.record(.runtimeCreated)
      }
      Task {
        await AppIntentDispatcher.shared.setShortcutsRefreshHandler {
          AppShortcuts.updateAppShortcutParameters()
        }
        AppShortcuts.updateAppShortcutParameters()
      }
    }
  }
}
