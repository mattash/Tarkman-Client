import { expect, it, jest } from '@jest/globals'
import { createApi } from '../features/live/api'
it('uses only public read contracts, no credentials, caching, or redirect following', async () => {
  const request = jest.fn<typeof fetch>().mockResolvedValue({ ok: true, json: async () => ({ message: 'No services' }) } as Response)
  await createApi('https://example.test', request).services(new AbortController().signal)
  expect(request.mock.calls[0][0]).toMatch(/^https:\/\/example.test\/services.json\?tz=/)
  expect(request.mock.calls[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', 'X-Polling-Client': 'true' } })
})
it('rejects failed responses instead of normalizing them as empty content', async () => {
  const request = jest.fn<typeof fetch>().mockResolvedValue({ ok: false, status: 503 } as Response)
  await expect(createApi('https://example.test', request).parts(7, new AbortController().signal)).rejects.toThrow('Could not load')
})
it('reads and validates the small revisioned state endpoint', async () => {
  const request = jest.fn<typeof fetch>().mockResolvedValue({ ok: true, json: async () => ({ session: {
    id: 7, revision: 0, content_context: 'v1', cursor: null, status: 'active', status_message: null, posture: null, date: null,
  } }) } as Response)
  const result = await createApi('https://example.test', request).state!(7, new AbortController().signal)
  expect(request.mock.calls[0][0]).toBe('https://example.test/s/7/state.json')
  expect(result).toMatchObject({ id: 7, revision: 0, contentContext: 'v1', cursor: null })
})
it.each([404, 405])('allows legacy compatibility only when the new endpoint is unavailable (%i)', async status => {
  const request = jest.fn<typeof fetch>().mockResolvedValue({ ok: false, status } as Response)
  await expect(createApi('https://example.test', request).state!(7, new AbortController().signal)).resolves.toBeNull()
})
it.each([401, 403, 500, 503])('does not hide state endpoint failures (%i) behind a legacy fetch', async status => {
  const request = jest.fn<typeof fetch>().mockResolvedValue({ ok: false, status } as Response)
  await expect(createApi('https://example.test', request).state!(7, new AbortController().signal)).rejects.toThrow()
})
