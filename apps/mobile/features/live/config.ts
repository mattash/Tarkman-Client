export interface Endpoints { api: string; cable: string }
export type ReaderConfig = { endpoints: Endpoints; error?: never } | { endpoints?: never; error: string }
function localHost(host: string): boolean {
  if (host === 'localhost' || host === '[::1]' || host.endsWith('.local')) return true
  const octets = host.split('.')
  if (octets.length !== 4 || !octets.every(octet => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)) return false
  const [a, b] = octets.map(Number)
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)
}
export function validateConfig(api: unknown, cable: unknown, development: boolean): ReaderConfig {
  try {
    const parse = (value: unknown, kind: 'api' | 'cable') => {
      if (typeof value !== 'string' || !value || (/[\s\\]/.test(value) || [...value].some(char => char.charCodeAt(0) < 32))) throw new Error()
      const url = new URL(value)
      const secure = kind === 'api' ? 'https:' : 'wss:'
      const insecure = kind === 'api' ? 'http:' : 'ws:'
      if (!url.hostname || url.username || url.password || url.search || url.hash || (url.protocol !== secure && !(development && localHost(url.hostname) && url.protocol === insecure))) throw new Error()
      return url.href.replace(/\/$/, '')
    }
    return { endpoints: { api: parse(api, 'api'), cable: parse(cable, 'cable') } }
  } catch {
    // A build configuration error for developers, never seen by readers of a configured build.
    return { error: 'Live reader is not configured. Set EXPO_PUBLIC_API_URL and EXPO_PUBLIC_ACTIONCABLE_URL to public HTTPS/WSS endpoints. Local development may use HTTP/WS on a local host. Credentials, queries and fragments are not allowed.' } // i18n-ignore
  }
}
export function readerConfig(): ReaderConfig {
  return validateConfig(process.env.EXPO_PUBLIC_API_URL, process.env.EXPO_PUBLIC_ACTIONCABLE_URL, __DEV__)
}
