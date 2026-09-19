import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { act, render } from '@testing-library/react-native'
import { AppState } from 'react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { I18nProvider } from '../features/i18n'
import { DisplayProjection } from '../features/displayLinks/DisplayProjection'
import { DEFAULT_DISPLAY_CONFIG, type DisplayPreferences } from '../features/displayLinks/config'
import type { ProjectionText } from '../features/displayLinks/ProjectionText'
import { useReader } from '../features/live/useReader'
import { initialState } from '../features/live/state'
import { normalizeParts, normalizeSession } from '../features/live/contracts'

const mockColumns = new Map<string, Parameters<typeof ProjectionText>[0]>()
jest.mock('../features/displayLinks/ProjectionText', () => ({ ProjectionText: (props: Parameters<typeof ProjectionText>[0]) => {
  mockColumns.set(props.language ?? 'message', props); return null
} }))
jest.mock('../features/live/useReader')
let now = 0
const appListeners = new Set<(state: 'active' | 'background') => void>()
const parts = normalizeParts({ parts: [11, 12].map(liturgy_part_id => ({ part: { id: 1, liturgy_id: 10, liturgy_part_id,
  role: 'Choir', en: 'Our Father', grabar: 'Հայր մեր', effective_duration_ms: 60000 } })) })
const session = normalizeSession({ session: { id: 42, current_part_id: 1, current_liturgy_id: 10, current_liturgy_part_id: 11, status: 'active' } })
function state(overrides = {}) {
  jest.mocked(useReader).mockReturnValue({ saved: null, state: { ...initialState, loading: false, session, parts, ...overrides },
    retry: jest.fn(), refreshAfterCommand: jest.fn(), dispatch: jest.fn() })
}
const view = (preferences: Partial<DisplayPreferences> = {}) => <ThemeProvider><I18nProvider><DisplayProjection apiBase="https://api.test" cableBase="wss://api.test/cable"
  config={{ ...DEFAULT_DISPLAY_CONFIG, lang1: 'grabar', lang2: 'en', ...preferences }} sessionId={42} /></I18nProvider></ThemeProvider>
beforeEach(() => {
  now = 0; mockColumns.clear(); appListeners.clear()
  jest.spyOn(performance, 'now').mockImplementation(() => now)
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appListeners.add(listener); return { remove: () => { appListeners.delete(listener) } }
  })
  state()
})
afterEach(() => { jest.restoreAllMocks() })

it('gives translations one duration and clock, keeps it across polling, and resets for a different occurrence of the same part', async () => {
  const rendered = await render(view())
  const first = mockColumns.get('en')!
  expect(first.clock).toBe(mockColumns.get('grabar')!.clock)
  expect(first.durationMs).toBe(60000)
  now = 12000
  state({ session: { ...session, revision: 2 } })
  await rendered.rerender(view())
  expect(mockColumns.get('en')!.clock).toBe(first.clock)
  expect(first.clock.elapsed()).toBe(12000)
  state({ session: { ...session, currentLiturgyPartId: 12 } })
  await rendered.rerender(view())
  expect(mockColumns.get('en')!.clock).not.toBe(first.clock)
  expect(mockColumns.get('en')!.clock.elapsed()).toBe(0)
})
it.each(['message', 'failure', 'background'])('suspends for %s and resumes the same occurrence without restarting', async reason => {
  const rendered = await render(view())
  const clock = mockColumns.get('en')!.clock
  now = 10000
  if (reason === 'message') state({ session: { ...session, status: 'paused', message: 'Please wait.' } })
  if (reason === 'failure') state({ error: 'Unavailable' })
  if (reason === 'background') await act(() => { for (const listener of appListeners) listener('background') })
  else await rendered.rerender(view())
  now = 20000
  expect(clock.elapsed()).toBe(10000)
  expect(clock.running()).toBe(false)
  if (reason === 'background') await act(() => { for (const listener of appListeners) listener('active') })
  else { state(); await rendered.rerender(view()) }
  expect(mockColumns.get('en')!.clock).toBe(clock)
  now = 25000
  expect(clock.elapsed()).toBe(15000)
})
it('preserves independent manual positions through an announcement and resets them for a new occurrence', async () => {
  const preferences = { text_movement: 'manual', language_sync: 'independent' } as const
  const rendered = await render(view(preferences))
  const english = mockColumns.get('en')!.manualPosition!
  const armenian = mockColumns.get('grabar')!.manualPosition!
  expect(english).not.toBe(armenian)
  english.set(0.4)
  armenian.set(0.7)
  state({ session: { ...session, status: 'paused', message: 'Please wait.' } })
  await rendered.rerender(view(preferences))
  state()
  await rendered.rerender(view(preferences))
  expect(mockColumns.get('en')!.manualPosition).toBe(english)
  expect(mockColumns.get('grabar')!.manualPosition).toBe(armenian)
  expect(english.get()).toBe(0.4)
  expect(armenian.get()).toBe(0.7)
  state({ session: { ...session, currentLiturgyPartId: 12 } })
  await rendered.rerender(view(preferences))
  expect(mockColumns.get('en')!.manualPosition!.get()).toBe(0)
  expect(mockColumns.get('grabar')!.manualPosition!.get()).toBe(0)
})
