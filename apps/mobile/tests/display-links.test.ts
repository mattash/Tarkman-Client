import { DEFAULT_CUSTOMIZATION } from '../features/displayLinks/customization'
import { expect, it } from '@jest/globals'
import { isDisplayLanguage, isDisplayMode, isDisplayStatusView } from '../features/displayLinks/config'
import { mergeDisplayConfig, normalizeConfig, normalizeOverrides, withDefaults } from '../features/displayLinks/normalize'
import { fetchDisplayLink } from '../features/displayLinks/api'

const validConfig = {
  token: 'abc', user_id: 7, mode: 'parallel' as const, lang1: 'translit' as const, lang2: 'en' as const,
  show_explanations: false, show_notifications: true, status_view: 'full' as const,
}

it('accepts only documented display languages, modes, and status views', () => {
  for (const value of ['translit', 'en', 'hye', 'hyw', 'grabar']) expect(isDisplayLanguage(value)).toBe(true)
  expect(isDisplayLanguage('armenian')).toBe(false)
  expect(isDisplayLanguage(null)).toBe(false)
  expect(isDisplayMode('parallel')).toBe(true)
  expect(isDisplayMode('quad')).toBe(false)
  expect(isDisplayStatusView('pages_only')).toBe(true)
  expect(isDisplayStatusView('minimal')).toBe(false)
})

it('drops invalid URL parameters and keeps valid ones', () => {
  const result = normalizeOverrides({
    mode: 'quad', lang1: 'armenian', lang2: null, show_explanations: 'yes',
    show_notifications: false, status_view: 'pages_only',
  })
  expect(result).toEqual({ lang2: null, show_notifications: false, status_view: 'pages_only' })
})

it('lets the token authoritatively override URL parameters', () => {
  const overrides = normalizeOverrides({ mode: 'single', lang1: 'en' })
  const merged = mergeDisplayConfig({ ...validConfig, mode: 'single', lang1: 'en' }, overrides)
  expect(merged.mode).toBe('single')
  expect(merged.token).toBe('abc')
  // Re-applying the same config cannot be overridden by stale URL parameters.
  const reMerged = mergeDisplayConfig(merged, normalizeOverrides({ mode: 'quad' }))
  expect(reMerged.mode).toBe('single')
})

it('falls back to defaults for missing fields', () => {
  const filled = withDefaults({ token: 'x', user_id: 1 })
  expect(filled.mode).toBe('parallel')
  expect(filled.lang1).toBe('translit')
  expect(filled.status_view).toBe('full')
  expect(filled.show_notifications).toBe(true)
})

it('drops unrecoverable configurations and falls back on invalid field values', () => {
  expect(normalizeConfig(null)).toBeNull()
  expect(normalizeConfig('not an object')).toBeNull()
  expect(normalizeConfig({ token: '', user_id: 1 })).toBeNull()
  expect(normalizeConfig({ token: 'abc', user_id: 'not-a-number' })).toBeNull()
  // Invalid field values fall back to defaults; valid fields survive.
  const config = normalizeConfig({
    token: 'abc', user_id: 7, mode: 'quad', lang1: 'armenian',
    show_explanations: 'yes', show_notifications: false, status_view: 'minimal',
  })
  expect(config).toEqual({
    ...DEFAULT_CUSTOMIZATION,
    token: 'abc', user_id: 7,
    mode: 'parallel', lang1: 'translit',
    lang2: 'en', show_explanations: false, show_notifications: false, status_view: 'full',
  })
})

function fakeFetch(handlers: Record<string, () => Promise<Response>>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    for (const [match, handler] of Object.entries(handlers)) if (url.endsWith(match)) return handler()
    throw new Error(`Unhandled: ${url}`)
  }) as unknown as typeof fetch
}

it('returns the configuration on a successful fetch', async () => {
  const request = fakeFetch({ '/display_links/abc': async () => new Response(JSON.stringify(validConfig), { status: 200, headers: { 'Content-Type': 'application/json' } }) })
  await expect(fetchDisplayLink('https://api.test', 'abc', request)).resolves.toEqual({ ...DEFAULT_CUSTOMIZATION, ...validConfig })
})

it('rejects with the invalid-link message on 404', async () => {
  const request = fakeFetch({ '/display_links/bad': async () => new Response('', { status: 404 }) })
  await expect(fetchDisplayLink('https://api.test', 'bad', request)).rejects.toThrow('Invalid or expired display link.')
})

it('rejects with the load-failure message on other errors', async () => {
  const request = fakeFetch({ '/display_links/x': async () => new Response('', { status: 500 }) })
  await expect(fetchDisplayLink('https://api.test', 'x', request)).rejects.toThrow('Could not load the display configuration.')
})

it('sends no Authorization header; the token is its own capability', async () => {
  let seen: RequestInit | undefined
  const request: typeof fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    seen = init
    return new Response(JSON.stringify(validConfig), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
  await fetchDisplayLink('https://api.test', 'abc', request)
  expect(seen?.credentials).toBe('omit')
  expect((seen?.headers as Record<string, string> | undefined)?.Authorization).toBeUndefined()
})

it('accepts incomplete additive versioned GET payloads with tolerant presentation defaults', async () => {
  const data = { ...validConfig, config_version: 4, font_scale: 'bad', expires_at: '2020-01-01T00:00:00Z' }
  const request = fakeFetch({ '/display_links/abc': async () => new Response(JSON.stringify(data)) })
  await expect(fetchDisplayLink('https://api.test', 'abc', request)).resolves.toMatchObject({
    ...validConfig, config_version: 4, font_scale: 100, expires_at: data.expires_at,
  })
})
it.each([
  null, {}, { token: 'other', user_id: 7 }, { token: 'abc', user_id: 0 },
  { ...validConfig, config_version: -1 }, { ...validConfig, config_version: '4' },
  { ...validConfig, expires_at: 'invalid' }, { ...validConfig, expires_at: false },
])('refuses unrecoverable GET payloads without defaulting identity or expiration: %j', async data => {
  const request = fakeFetch({ '/display_links/abc': async () => new Response(JSON.stringify(data)) })
  await expect(fetchDisplayLink('https://api.test', 'abc', request)).rejects.toThrow()
})
it.each([403, 404, 410])('preserves terminal HTTP status %s even with a valid payload', async status => {
  const request = fakeFetch({ '/display_links/abc': async () => new Response(JSON.stringify(validConfig), { status }) })
  await expect(fetchDisplayLink('https://api.test', 'abc', request)).rejects.toThrow('Invalid or expired display link.')
})

it('retains Eastern Armenian from the API and URL in either display column', () => {
  expect(normalizeConfig({ ...validConfig, lang1: 'hye', lang2: 'hye' })).toMatchObject({ lang1: 'hye', lang2: 'hye' })
  expect(normalizeOverrides({ lang1: 'hye', lang2: 'hye' })).toEqual({ lang1: 'hye', lang2: 'hye' })
})
