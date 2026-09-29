import { describe, expect, it, jest } from '@jest/globals'
import { createPublicDirectoryApi, DirectoryError, normalizeChurch, normalizeChurchPage, normalizeLinks } from '../src/directory'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const signal = new AbortController().signal
const api = (handler: (url: string) => Response | Promise<Response>) =>
  createPublicDirectoryApi({ base: 'https://api.test', request: jest.fn(async (input: RequestInfo | URL) => handler(String(input))) as unknown as typeof fetch })

describe('directory contract', () => {
  it('keeps only allowlisted church fields, drops malformed rows and duplicates', () => {
    const page = normalizeChurchPage({ churches: [
      { id: 'a', name: ' St. John ', locality: 'Southfield', owner_email: 'x@y.z' },
      { id: 'a', name: 'Duplicate' },
      { id: 7, name: 'Numeric id' },
      { id: '', name: 'No id' }, { id: 'b' }, 'nope', null,
    ], pagination: { page: 1, per_page: 25, total_count: 30, next_page: 2 } })
    expect(page).toEqual({ churches: [{ id: 'a', name: 'St. John', locality: 'Southfield' }, { id: '7', name: 'Numeric id', locality: null }], nextCursor: '2' })
    expect(JSON.stringify(page)).not.toContain('owner_email')
  })
  it('rejects unreadable pages instead of guessing', () => {
    expect(normalizeChurchPage({ churches: 'no' })).toBeNull()
    expect(normalizeChurchPage([])).toBeNull()
    expect(normalizeChurchPage({ churches: [], pagination: { next_page: 'x' } })).toBeNull()
    expect(normalizeChurch({ id: 'x'.repeat(400), name: 'Long' })).toBeNull()
  })
  it('lists only well-formed display links with a launch token, no whitespace, no extras', () => {
    const links = normalizeLinks({ church: { id: 'c1', name: 'Church' }, display_links: [
      { id: 'l1', title: 'Sanctuary', token: 'abc123', private_note: 'x' },
      { id: 'l2', title: 'Bad token', token: 'has space' },
      { id: 'l3', title: '', token: 'ok' }, { id: 'l1', title: 'Dup', token: 'zzz' },
    ] })
    expect(links).toEqual({ church: { id: 'c1', name: 'Church', locality: null }, links: [{ id: 'l1', title: 'Sanctuary', token: 'abc123' }] })
    expect(normalizeLinks({ church: { id: 'c1', name: 'Church' } })).toBeNull()
  })
  it('sends only reads with no credentials, and maps query and cursor to q and page', async () => {
    const request = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input; void init
      return json({ churches: [], pagination: { page: 1, per_page: 10, total_count: 0, next_page: null } })
    })
    const client = createPublicDirectoryApi({ base: 'https://api.test', request: request as unknown as typeof fetch, pageSize: 10 })
    await client.churches(' Holy Cross & Sons ', '3', signal)
    const [url, init] = request.mock.calls[0]
    expect(String(url)).toBe('https://api.test/public/churches?per_page=10&q=Holy%20Cross%20%26%20Sons&page=3')
    expect(init).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' })
    expect(init?.method).toBeUndefined()
  })
  it('maps failures: 404 is an unknown church, everything else is unavailable', async () => {
    const kind = async (handler: () => Response | Promise<Response>) => api(handler).links('c1', signal).catch((error: unknown) => (error as DirectoryError).kind)
    expect(await kind(() => json({}, 404))).toBe('not_found')
    expect(await kind(() => json({}, 500))).toBe('unavailable')
    expect(await kind(() => json({ error: 'rate_limited' }, 429))).toBe('unavailable')
    expect(await kind(() => { throw new TypeError('network') })).toBe('unavailable')
    expect(await kind(() => new Response('<html>', { status: 200 }))).toBe('unavailable')
    expect(await kind(() => json({ church: null }))).toBe('unavailable')
  })
})
