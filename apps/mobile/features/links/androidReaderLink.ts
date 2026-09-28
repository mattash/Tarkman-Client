import { readScannedLink } from '../scan/links'

/** Android's API-24-compatible manifest globs cannot validate numeric IDs.
 * Validate the full HTTPS reader URL before Expo Router sees it. Custom schemes
 * and other platforms keep their existing handling in +native-intent.
 */
export function androidReaderLink(path: string): string {
  if (!/^https?:/i.test(path)) return path
  try {
    const url = new URL(path)
    const link = readScannedLink(path)
    if (url.protocol !== 'https:' || url.host !== 'web.tarkman.app' || link.kind === 'unknown') return '/'
    // Manifest claims only these current reader routes; scanner aliases remain
    // scanner inputs and web redirects, rather than expanding the app's scope.
    if (!/^\/sessions\/\d+\/(?:parts|part\/\d+)\/?$/.test(url.pathname)) return '/'
    // Route IDs belong to the path, never an overriding query parameter.
    url.searchParams.delete('id')
    url.searchParams.delete('partId')
    return `${link.path}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}
