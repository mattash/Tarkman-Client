import { createApi, normalizeEnvironment } from './api'
/** Release enablement requires a separate reviewed change. Only development or explicitly marked loopback fixture builds can enable networking. */
export function libraryConfiguration(development = __DEV__, capability = process.env.EXPO_PUBLIC_LIBRARY_TEST_CAPABILITY,
  raw = process.env.EXPO_PUBLIC_LIBRARY_API_URL, fixtureBuild = process.env.EXPO_PUBLIC_LIBRARY_FIXTURE_BUILD) {
  try {
    if (raw) {
      const environment = normalizeEnvironment(raw), url = new URL(environment)
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      const fixture = fixtureBuild === '1' && local
      if (url.protocol !== 'https:' && !((development || fixture) && local)) throw new Error('scheme')
      return { environment, api: (development || fixture) && capability === '1' ? createApi(environment) : null }
    }
  } catch { /* Invalid capability configuration is never a successful empty catalog. */ }
  return { environment: 'disabled', api: null }
}
