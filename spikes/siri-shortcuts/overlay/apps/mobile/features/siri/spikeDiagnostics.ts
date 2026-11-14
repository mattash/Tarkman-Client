import { requireOptionalNativeModule } from 'expo-modules-core'

const diagnostics = requireOptionalNativeModule<{
  recordDiagnostic(stage: string, invocationId: string): Promise<void>
}>('AppIntentsSetup')

/** Isolated test app only: bounded local phase markers, never speech/content/URLs. */
export function recordSpikeDiagnostic(stage: string, invocationId = ''): void {
  try {
    const result = diagnostics?.recordDiagnostic(stage, invocationId)
    if (result) void Promise.resolve(result).catch(() => {})
  } catch {
    // Diagnostics must not change navigation, acknowledgment or invocation outcome.
  }
}
