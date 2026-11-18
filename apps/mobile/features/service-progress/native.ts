import Constants from 'expo-constants'
import { NativeModules, Platform } from 'react-native'

export type ServiceProgressPresentationResult = 'unsupported' | 'presented' | 'unavailable' | 'failed'
interface ServiceProgressPresenter {
  presentService(sessionID: number, readerAPI: string): Promise<unknown>
}

/** A presentation is not consent, registration, an Activity start, or delivery. */
export async function presentServiceProgress(sessionID: number, readerAPI: string): Promise<ServiceProgressPresentationResult> {
  try {
    if (!productEnabled()) return 'unsupported'
    if (!Number.isSafeInteger(sessionID) || sessionID <= 0 ||
        (!isBareHTTPSOrigin(readerAPI) && !isSimulatorFixtureOrigin(readerAPI))) return 'failed'
    const presenter = nativePresenter()
    if (!presenter) return 'unsupported'
    // Native owns foreground/OS/trusted-origin admission and fresh per-service
    // verification, disclosure, start and stop. Pass no reader state or credentials.
    const result = await presenter.presentService(sessionID, readerAPI)
    return result === 'presented' || result === 'unavailable' || result === 'failed' ? result : 'failed'
  } catch {
    // Never expose native errors, URLs, tokens or arbitrary response values.
    return 'failed'
  }
}

/** Feature visibility only; native rechecks availability when actually presenting. */
export function isServiceProgressAvailable(): boolean {
  try { return productEnabled() && nativePresenter() !== null }
  catch { return false }
}

function productEnabled(): boolean {
  // Short-circuit before even consulting Expo configuration on other platforms.
  return Platform.OS === 'ios' && Constants.expoConfig?.extra?.serviceProgressProduct === true
}

function nativePresenter(): ServiceProgressPresenter | null {
  // Never cache or read this optional native getter at module initialization.
  const module: unknown = NativeModules.TarkmanServiceProgress
  if (!module || typeof module !== 'object' || !('presentService' in module) || typeof module.presentService !== 'function') return null
  return module as ServiceProgressPresenter
}

function isSimulatorFixtureOrigin(value: string): boolean {
  const extra = Constants.expoConfig?.extra
  if (extra?.serviceProgressProduct !== true || extra.serviceProgressSimulatorFixture !== true ||
      typeof value !== 'string' || value !== extra.serviceProgressSimulatorAPIOrigin) return false
  const match = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/.exec(value)
  return match !== null && match[0] === value && Number(match[1]) <= 65535
}

function isBareHTTPSOrigin(value: string): boolean {
  if (typeof value !== 'string' || !/^https:\/\/[^/?#\\\s]+$/.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.length > 0 && !url.username && !url.password &&
      url.pathname === '/' && !url.search && !url.hash
  } catch { return false }
}
