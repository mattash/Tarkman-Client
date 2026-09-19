import { beforeEach, expect, it, jest } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { I18nProvider, setActiveInterfaceLanguage } from '../features/i18n'
import { DisplayProjection } from '../features/displayLinks/DisplayProjection'
import { useReader } from '../features/live/useReader'
import { initialState } from '../features/live/state'
import type { DisplayLinkConfig } from '../features/displayLinks/config'
import { normalizeSession, normalizeParts, type LivePart, type LiveSession } from '../features/live/contracts'

// Silence the animated sync arrow; it spins a timer this test cannot unmount cleanly.
jest.mock('../features/live/ConnectionStatus', () => ({ ControlConnectionStatus: () => null }))
jest.mock('../features/live/useReader')
jest.mock('../features/live/lifecycle', () => ({ lifecycle: { listen: (cb: (a: boolean, o: boolean) => void) => { cb(true, true); return () => {} } } }))

const config: DisplayLinkConfig = {
  token: 'abc', user_id: 7, mode: 'parallel', lang1: 'en', lang2: null,
  show_explanations: false, show_notifications: true, status_view: 'full',
}

beforeEach(() => {
  setActiveInterfaceLanguage('en')
  jest.mocked(useReader).mockReturnValue({
    saved: null,
    state: { ...initialState, loading: false, stale: false, connected: true, session: null, parts: [] },
    retry: jest.fn(), refreshAfterCommand: jest.fn(), dispatch: jest.fn(),
  })
})

function renderProjection(overrides: Partial<Parameters<typeof DisplayProjection>[0]> = {}) {
  return render(
    <ThemeProvider><I18nProvider><DisplayProjection apiBase="https://api.test" cableBase="wss://api.test/cable" config={config} sessionId={42} {...overrides} /></I18nProvider></ThemeProvider>,
  )
}

it('reserves the service screen for reading text and one speaker label', async () => {
  const session: LiveSession = {
    id: 42, title: 'Divine Liturgy', church: 'St. John Armenian Church',
    currentPartId: 1, currentLiturgyPartId: 11, currentLiturgyId: 1, currentPosition: 1,
    status: 'active', message: null, date: '2026-09-18', currentRole: 'priest',
    revision: null, contentContext: null, latitude: null, longitude: null, partsContext: null,
  }
  const part: LivePart = {
    id: 1, key: 'lp:11', liturgyId: 1, liturgyPartId: 11, position: 1,
    role: 'priest', posture: 'stand', text: { en: 'Our Father...', ru: null, grabar: null, translit: null },
  }
  jest.mocked(useReader).mockReturnValue({
    saved: null,
    state: { ...initialState, loading: false, stale: false, connected: true, session, parts: [part] },
    retry: jest.fn(), refreshAfterCommand: jest.fn(), dispatch: jest.fn(),
  })
  await renderProjection()
  await waitFor(() => expect(screen.getByTestId('display-speaker')).toHaveTextContent('priest'))
  expect(screen.queryByText('St. John Armenian Church')).toBeNull()
  expect(screen.queryByText('Divine Liturgy')).toBeNull()
  expect(screen.getByText('Our Father...')).toBeOnTheScreen()
})

it('falls back to a no-text message when the selected language is missing on the part', async () => {
  const session: LiveSession = {
    id: 42, title: 'Prayer', church: 'St. John',
    currentPartId: 1, currentLiturgyPartId: 11, currentLiturgyId: 1, currentPosition: 1,
    status: 'active', message: null, date: '2026-09-18', currentRole: 'priest',
    revision: null, contentContext: null, latitude: null, longitude: null, partsContext: null,
  }
  const part: LivePart = {
    id: 1, key: 'lp:11', liturgyId: 1, liturgyPartId: 11, position: 1,
    role: 'priest', posture: null, text: { en: null, ru: null, grabar: null, translit: null },
  }
  jest.mocked(useReader).mockReturnValue({
    saved: null,
    state: { ...initialState, loading: false, stale: false, connected: true, session, parts: [part] },
    retry: jest.fn(), refreshAfterCommand: jest.fn(), dispatch: jest.fn(),
  })
  await renderProjection()
  await waitFor(() => expect(screen.getByText('No text is available in the selected language.')).toBeOnTheScreen())
})

it('shows a clear unavailable message when the session fails to load', async () => {
  jest.mocked(useReader).mockReturnValue({
    saved: null,
    state: { ...initialState, loading: false, error: 'Not found', session: null, parts: [] },
    retry: jest.fn(), refreshAfterCommand: jest.fn(), dispatch: jest.fn(),
  })
  await renderProjection()
  await waitFor(() => expect(screen.getByTestId('display-projection-unavailable')).toBeOnTheScreen())
  expect(screen.getByText('This service is not available right now.')).toBeOnTheScreen()
})

it('renders both languages without ancillary projection labels', async () => {
  const session = normalizeSession({ session: { id: 42, current_part_id: 1, current_liturgy_id: 10, current_liturgy_part_id: 11, page: 24, posture: 'stand' } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, liturgy_id: 10, liturgy_part_id: 11, en: 'Peace unto all.', grabar: 'Խաղաղութիւն ամենեցուն։' } }] })
  jest.mocked(useReader).mockReturnValue({ saved: null, state: { ...initialState, loading: false, stale: false, connected: true, session, parts,
    explanations: [{ id: 1, title: 'Peace', description: null, liturgyPartId: 11 }] }, retry: jest.fn(), refreshAfterCommand: jest.fn(), dispatch: jest.fn() })
  await renderProjection({ config: { ...config, lang2: 'grabar', show_explanations: true } })
  expect(screen.getByText('Peace unto all.')).toBeOnTheScreen()
  expect(screen.getByText('Խաղաղութիւն ամենեցուն։')).toBeOnTheScreen()
  expect(screen.queryByText('Explanation available')).toBeNull()
  expect(screen.queryByText('Page 24')).toBeNull()
  expect(screen.queryByText('Stand')).toBeNull()
  expect(jest.mocked(useReader).mock.calls.at(-1)?.[2]).toBe(false)
})
it.each(['full', 'pages_only', 'posture_only'] as const)('renders minimal status %s without reading text', async status_view => {
  const session = normalizeSession({ session: { id: 42, page: 123, posture: 'kneel' } })
  jest.mocked(useReader).mockReturnValue({ saved: null, state: { ...initialState, loading: false, stale: false, connected: true, session }, retry: jest.fn(), refreshAfterCommand: jest.fn(), dispatch: jest.fn() })
  await renderProjection({ statusOnly: true, config: { ...config, status_view } })
  expect(screen.getByTestId('display-status')).toBeOnTheScreen()
  expect(screen.queryByTestId('display-projection-text')).toBeNull()
  expect(screen.queryByText('123') !== null).toBe(status_view !== 'posture_only')
  expect(screen.queryByLabelText('Kneel') !== null).toBe(status_view !== 'pages_only')
  expect(screen.queryByText('Hymnal page')).toBeNull()
  expect(jest.mocked(useReader).mock.calls.at(-1)?.[2]).toBe(false)
})
it('replaces an unreadable recovery badge with a notice and restores the reading after recovery', async () => {
  const session = normalizeSession({ session: { id: 42, current_part_id: 1, current_liturgy_part_id: 11 } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, liturgy_part_id: 11, en: 'Peace unto all.' } }] })
  const reader = { saved: null, state: { ...initialState, loading: false, error: 'Network unavailable', session, parts },
    retry: jest.fn(), refreshAfterCommand: jest.fn(), dispatch: jest.fn() }
  jest.mocked(useReader).mockReturnValue(reader)
  const view = await renderProjection()
  expect(screen.getByTestId('display-connection')).toBeOnTheScreen()
  expect(screen.queryByText('Peace unto all.')).toBeNull()
  jest.mocked(useReader).mockReturnValue({ ...reader, state: { ...reader.state, error: null } })
  await view.rerender(<ThemeProvider><I18nProvider><DisplayProjection apiBase="https://api.test" cableBase="wss://api.test/cable" config={config} sessionId={42} /></I18nProvider></ThemeProvider>)
  expect(screen.getByText('Peace unto all.')).toBeOnTheScreen()
  expect(screen.queryByTestId('display-connection')).toBeNull()
})
