import { createApi, normalizeEnvironment } from './api'
/**
 * Two ways to reach a Library API:
 * - Release: `EXPO_PUBLIC_LIBRARY_ENABLED=1` is the production switch. It uses `EXPO_PUBLIC_LIBRARY_API_URL`, else the
 *   app's `EXPO_PUBLIC_API_URL`, and accepts HTTPS only. Unset it and redeploy/republish to turn the Library off.
 * - Testing: development builds, or explicitly marked loopback fixture builds, with `EXPO_PUBLIC_LIBRARY_TEST_CAPABILITY=1`.
 */
export function libraryConfiguration(development = __DEV__, capability = process.env.EXPO_PUBLIC_LIBRARY_TEST_CAPABILITY,
  raw = process.env.EXPO_PUBLIC_LIBRARY_API_URL, fixtureBuild = process.env.EXPO_PUBLIC_LIBRARY_FIXTURE_BUILD,
  enabled = process.env.EXPO_PUBLIC_LIBRARY_ENABLED, apiUrl = process.env.EXPO_PUBLIC_API_URL) {
  try {
    const source = raw || (enabled === '1' ? apiUrl : undefined)
    if (source) {
      const environment = normalizeEnvironment(source), url = new URL(environment)
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      const fixture = fixtureBuild === '1' && local
      if (url.protocol !== 'https:' && !((development || fixture) && local)) throw new Error('scheme')
      const testing = (development || fixture) && capability === '1'
      const released = enabled === '1' && url.protocol === 'https:'
      return { environment, api: testing || released ? createApi(environment) : null }
    }
  } catch { /* Invalid capability configuration is never a successful empty catalog. */ }
  return { environment: 'disabled', api: null }
}
