import { it, expect, jest } from '@jest/globals'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import bundle from './fixtures/public_liturgies/bundle.json'
import updated from './fixtures/public_liturgies/bundle_updated.json'
import catalog from './fixtures/public_liturgies/catalog.json'
import omitted from './fixtures/public_liturgies/catalog_content_error_page.json'
import page from './fixtures/public_liturgies/catalog_page.json'
import { byteLength, isUnavailable, parseBundle, parseCatalog } from '../features/library/contracts'
import { libraryConfiguration } from '../features/library/config'
import { createApi } from '../features/library/api'
import manifest from './fixtures/public_liturgies.sha256.json'
const clone = () => JSON.parse(JSON.stringify(bundle))
it('pins every backend fixture byte-for-byte, optionally against the backend checkout', () => {
  for (const [file, hash] of Object.entries(manifest)) {
    const local = readFileSync(join(__dirname, 'fixtures/public_liturgies', file))
    expect(createHash('sha256').update(local).digest('hex')).toBe(hash)
    if (process.env.LIBRARY_BACKEND_FIXTURES) expect(readFileSync(join(process.env.LIBRARY_BACKEND_FIXTURES, file))).toEqual(local)
  }
  expect(readdirSync(join(__dirname, 'fixtures/public_liturgies')).sort()).toEqual(Object.keys(manifest).sort())
})
it('preserves repeated part identity, null translations, context and explanation ownership', () => {
  const result = parseBundle(bundle, 701)
  expect(result.parts.map(p => p.liturgy_part_id)).toEqual([901, 902, 903])
  expect(result.parts.map(p => p.part_id)).toEqual([801, 801, 802])
  expect(result.parts[0].explanations).toEqual([])
  expect(result.parts[1].explanations[0].liturgy_part_id).toBe(902)
  expect(result.parts[2].text.en).toBeNull()
  expect(result.parts[2].requires_session_context).toBe(true)
  expect(parseBundle(updated).revision).not.toBe(result.revision)
  expect(parseCatalog(catalog).liturgies[0].download_bytes).toBe(byteLength(JSON.stringify(bundle)))
})
it.each([
  (b: ReturnType<typeof clone>) => { b.schema_version = 2 },
  (b: ReturnType<typeof clone>) => { delete b.parts[0].text.ru },
  (b: ReturnType<typeof clone>) => { b.parts[1].liturgy_part_id = 901 },
  (b: ReturnType<typeof clone>) => { b.parts[1].explanations[0].liturgy_part_id = 901 },
  (b: ReturnType<typeof clone>) => { b.parts[1].liturgy_id = 702 },
  (b: ReturnType<typeof clone>) => { b.parts[0].part_id = Number.MAX_SAFE_INTEGER + 1 },
  (b: ReturnType<typeof clone>) => { b.parts[2].text.en = 'internal_attribute' },
  (b: ReturnType<typeof clone>) => { b.parts[0].page = 0 },
  (b: ReturnType<typeof clone>) => { b.parts.reverse() },
  (b: ReturnType<typeof clone>) => { b.revision = '' },
  (b: ReturnType<typeof clone>) => { b.parts[0].text.en = 'x'.repeat(1024 * 1024 + 1) },
])('rejects malformed durable content', mutate => { const value = clone(); mutate(value); expect(() => parseBundle(value, 701)).toThrow() })
it('projects away all unknown fields and rejects mismatched request identity', () => {
  const value = clone(); value.creator = 'private'; value.parts[0].session_id = 99; value.parts[0].text.token = 'private'
  expect(JSON.stringify(parseBundle(value))).not.toContain('private')
  expect(() => parseBundle(value, 702)).toThrow()
})
it('requires strictly advancing pagination, permits same positions ordered by occurrence ID', () => {
  expect(() => parseCatalog({ ...catalog, next_after_id: 1 })).toThrow()
  expect(() => parseCatalog(catalog, 701)).toThrow()
  const value = clone(); value.parts[1].position = 1; expect(parseBundle(value).parts).toHaveLength(3)
})
it('only exact typed unavailability authorizes removal', () => {
  expect(isUnavailable({ schema_version: 1, error: { code: 'public_liturgy_unavailable' } })).toBe(true)
  expect(isUnavailable({ error: { code: 'public_liturgy_unavailable' } })).toBe(false)
  expect(isUnavailable({ schema_version: 1, error: { code: 'bundle_too_large' } })).toBe(false)
})
function response(status: number, body: unknown) { return { status, ok: status === 200, headers: { get: () => null }, text: async () => JSON.stringify(body) } as unknown as Response }
it('uses anonymous dedicated URLs and conditional quoted ETags', async () => {
  const fetcher = jest.fn<typeof fetch>().mockResolvedValue(response(200, bundle))
  const api = createApi('https://example.test/', fetcher)
  await api.bundle(701, new AbortController().signal, bundle.revision)
  expect(fetcher).toHaveBeenCalledWith('https://example.test/public/liturgies/701/download.json', expect.objectContaining({ credentials: 'omit', redirect: 'error', headers: { Accept: 'application/json', 'If-None-Match': `"${bundle.revision}"` } }))
})
it.each([[404, { schema_version: 1, error: { code: 'public_liturgy_unavailable' } }, 'unavailable'], [404, {}, 'network'], [422, { schema_version: 1, error: { code: 'bundle_too_large' } }, 'size'], [422, { schema_version: 1, error: { code: 'invalid_public_liturgy_content' } }, 'invalid'], [400, { schema_version: 1, error: { code: 'invalid_public_liturgy_parameters' } }, 'invalid']])('distinguishes per-item HTTP failures (%s)', async (status, body, code) => {
  const api = createApi('https://example.test', jest.fn<typeof fetch>().mockResolvedValue(response(status as number, body)))
  await expect(api.bundle(701, new AbortController().signal)).rejects.toMatchObject({ code })
})

it('capability is off by default and cannot enable a production build', () => {
  expect(libraryConfiguration(false, '1', 'https://example.test').api).toBeNull()
  expect(libraryConfiguration(true, undefined, 'https://example.test').api).toBeNull()
  expect(libraryConfiguration(true, '1', 'http://127.0.0.1:4190').api).not.toBeNull()
  expect(libraryConfiguration(true, '1', 'http://public.example.test').api).toBeNull()
  expect(libraryConfiguration(true, '1', 'https://user:secret@example.test').api).toBeNull()
})
it('aborts timed-out anonymous requests and does not accept HTML or announced oversized bodies', async () => {
  jest.useFakeTimers()
  try {
    const stalled = jest.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('abort')))
    }))
    const pending = createApi('https://example.test', stalled).bundle(701, new AbortController().signal)
    const check = expect(pending).rejects.toMatchObject({ code: 'network' })
    await jest.advanceTimersByTimeAsync(20001); await check
  } finally { jest.useRealTimers() }
  const html = { ...response(200, {}), text: async () => '<html>login</html>' } as Response
  await expect(createApi('https://example.test', jest.fn<typeof fetch>().mockResolvedValue(html)).bundle(701, new AbortController().signal)).rejects.toMatchObject({ code: 'invalid' })
  const huge = { ...response(200, {}), headers: { get: () => '10485761' } } as unknown as Response
  await expect(createApi('https://example.test', jest.fn<typeof fetch>().mockResolvedValue(huge)).bundle(701, new AbortController().signal)).rejects.toMatchObject({ code: 'size' })
})

it('embedded fixture builds can test native offline cold start without opening release production integration', () => {
  expect(libraryConfiguration(false, '1', 'http://127.0.0.1:4190', '1').api).not.toBeNull()
  expect(libraryConfiguration(false, '1', 'https://example.test', '1').api).toBeNull()
  expect(libraryConfiguration(false, '1', 'http://127.0.0.1:4190', undefined).api).toBeNull()
})

it('release builds reach the Library only through the explicit HTTPS production switch', () => {
  const release = (enabled?: string, apiUrl?: string, raw?: string) => libraryConfiguration(false, undefined, raw, undefined, enabled, apiUrl)
  expect(release('1', 'https://www.tarkman.app')).toMatchObject({ environment: 'https://www.tarkman.app' })
  expect(release('1', 'https://www.tarkman.app').api).not.toBeNull()
  // The Library URL overrides the app API URL and names the storage environment.
  expect(release('1', 'https://www.tarkman.app', 'https://library.example.test').environment).toBe('https://library.example.test')
  // Switch absent or off: disabled even with a valid production API URL.
  expect(release(undefined, 'https://www.tarkman.app')).toEqual({ environment: 'disabled', api: null })
  expect(release('0', 'https://www.tarkman.app')).toEqual({ environment: 'disabled', api: null })
  // Never plain HTTP, loopback or credentials in a release build.
  expect(release('1', 'http://www.tarkman.app').api).toBeNull()
  expect(release('1', 'http://127.0.0.1:4190').api).toBeNull()
  expect(release('1', 'https://user:secret@www.tarkman.app').api).toBeNull()
  expect(release('1', undefined).api).toBeNull()
})

it('accepts omitted-content continuations only when they advance, retaining nonempty cursor rules', () => {
  expect(parseCatalog(omitted)).toEqual(omitted)
  expect(parseCatalog(omitted, 699)).toEqual(omitted)
  expect(parseCatalog({ ...omitted, next_after_id: null }, 700).next_after_id).toBeNull()
  expect(parseCatalog(page, 700).next_after_id).toBe(701)
  expect(() => parseCatalog({ ...page, next_after_id: 702 }, 700)).toThrow()
  expect(() => parseCatalog({ ...catalog, liturgies: Array(101).fill(catalog.liturgies[0]) })).toThrow()
})
it.each([0, -1, 699, 700, 700.5, Number.MAX_SAFE_INTEGER + 1, '701', undefined])('rejects invalid or nonadvancing empty-page cursor %s', next => {
  expect(() => parseCatalog({ ...omitted, next_after_id: next }, 700)).toThrow()
})
it('API carries an omitted-content cursor to later valid content exactly once', async () => {
  const fetcher = jest.fn<typeof fetch>().mockResolvedValueOnce(response(200, omitted)).mockResolvedValueOnce(response(200, catalog))
  const api = createApi('https://example.test', fetcher), signal = new AbortController().signal
  const first = await api.catalog(signal)
  expect(first.liturgies).toEqual([])
  expect(first.next_after_id).toBe(700)
  const second = await api.catalog(signal, first.next_after_id!)
  expect(second).toEqual(parseCatalog(catalog))
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    'https://example.test/public/liturgies.json?limit=100',
    'https://example.test/public/liturgies.json?limit=100&after_id=700',
  ])
})
it.each([699, 700])('API rejects an empty-page cursor %s that does not advance past the request', async next => {
  const fetcher = jest.fn<typeof fetch>().mockResolvedValue(response(200, { ...omitted, next_after_id: next }))
  await expect(createApi('https://example.test', fetcher).catalog(new AbortController().signal, 700)).rejects.toMatchObject({ code: 'invalid' })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
