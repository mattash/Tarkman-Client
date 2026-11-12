import { byteLength, integer, isPublicError, isUnavailable, LibraryError, MAX_BUNDLE_BYTES, parseBundle, parseCatalog, type Bundle, type Catalog } from './contracts'
export interface LibraryApi {
  catalog(signal: AbortSignal, after?: number, recommended?: boolean): Promise<Catalog>
  bundle(id: number, signal: AbortSignal, revision?: string): Promise<Bundle | null>
}
export function normalizeEnvironment(raw: string): string {
  const url = new URL(raw)
  if (url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol)) throw new LibraryError('invalid')
  return url.href.replace(/\/$/, '')
}
export function parseRetryAfter(header: string | null, now = Date.now()): number {
  const value = header?.trim() ?? ''
  if (/^\d+$/.test(value)) {
    const delay = Number(value) * 1000
    if (Number.isFinite(delay)) return delay
  }
  // Accept HTTP-date formats, not Date.parse's permissive numeric/date shorthand.
  const httpDate = /^(?:[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT|[A-Za-z]+, \d{2}-[A-Za-z]{3}-\d{2} \d{2}:\d{2}:\d{2} GMT|[A-Za-z]{3} [A-Za-z]{3} {1,2}\d{1,2} \d{2}:\d{2}:\d{2} \d{4})$/
  if (httpDate.test(value)) {
    // HTTP dates are always GMT, including asctime's timezone-less form.
    const date = Date.parse(value.endsWith(' GMT') ? value : `${value} GMT`)
    if (Number.isFinite(date)) return Math.max(0, date - now)
  }
  // Browsers may hide Retry-After when CORS does not expose it.
  return 60000
}
export function createApi(environment: string, fetcher: typeof fetch = fetch): LibraryApi {
  const base = normalizeEnvironment(environment)
  async function request(path: string, signal: AbortSignal, revision?: string, id?: number): Promise<unknown> {
    const controller = new AbortController(), abort = () => controller.abort()
    signal.addEventListener('abort', abort)
    if (signal.aborted) abort()
    const timer = setTimeout(abort, 20000)
    try {
      const response = await fetcher(`${base}${path}`, { signal: controller.signal, credentials: 'omit', redirect: 'error',
        headers: { Accept: 'application/json', ...(revision ? { 'If-None-Match': `"${revision}"` } : {}) } })
      if (response.status === 429) throw new LibraryError('rate-limited', parseRetryAfter(response.headers.get('retry-after')))
      if (response.status === 304 && id !== undefined) return null
      if (Number(response.headers.get('content-length')) > MAX_BUNDLE_BYTES) throw new LibraryError('size')
      // Native fetch has no portable streaming reader; check both announced and actual UTF-8 size.
      const raw = await response.text()
      if (byteLength(raw) > MAX_BUNDLE_BYTES) throw new LibraryError('size')
      let value: unknown
      try { value = JSON.parse(raw) } catch { throw new LibraryError('invalid') }
      if (response.status === 404 && id !== undefined && isUnavailable(value)) throw new LibraryError('unavailable')
      if (response.status === 422 && isPublicError(value, 'bundle_too_large')) throw new LibraryError('size')
      if ((response.status === 422 && isPublicError(value, 'invalid_public_liturgy_content')) ||
        (response.status === 400 && isPublicError(value, 'invalid_public_liturgy_parameters'))) throw new LibraryError('invalid')
      if (!response.ok) throw new LibraryError('network')
      if (controller.signal.aborted) throw new LibraryError('cancelled')
      return value
    } catch (error) {
      if (signal.aborted) throw new LibraryError('cancelled')
      throw error instanceof LibraryError ? error : new LibraryError('network')
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort) }
  }
  return {
    async catalog(signal, after = 0, recommended = false) {
      return parseCatalog(await request(`/public/liturgies.json?limit=100${after ? `&after_id=${after}` : ''}${recommended ? '&recommended=true' : ''}`, signal), after)
    },
    async bundle(id, signal, revision) {
      integer(id)
      const value = await request(`/public/liturgies/${id}/download.json`, signal, revision, id)
      return value === null ? null : parseBundle(value, id)
    },
  }
}
