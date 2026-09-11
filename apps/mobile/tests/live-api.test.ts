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
