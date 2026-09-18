import { beforeEach, expect, it, jest } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { I18nProvider, setActiveInterfaceLanguage } from '../features/i18n'
import { DisplayProjection } from '../features/displayLinks/DisplayProjection'
import { useReader } from '../features/live/useReader'
import { initialState } from '../features/live/state'
import type { DisplayLinkConfig } from '../features/displayLinks/config'
import type { LivePart, LiveSession } from '../features/live/contracts'

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

it('shows the church and service title once the session loads', async () => {
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
  renderProjection()
  await waitFor(() => expect(screen.getByTestId('display-projection-header')).toBeOnTheScreen())
  expect(screen.getByText('St. John Armenian Church')).toBeOnTheScreen()
  expect(screen.getByText('Divine Liturgy')).toBeOnTheScreen()
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
  renderProjection()
  await waitFor(() => expect(screen.getByText('No text is available in the selected language.')).toBeOnTheScreen())
})

it('shows a clear unavailable message when the session fails to load', async () => {
  jest.mocked(useReader).mockReturnValue({
    saved: null,
    state: { ...initialState, loading: false, error: 'Not found', session: null, parts: [] },
    retry: jest.fn(), refreshAfterCommand: jest.fn(), dispatch: jest.fn(),
  })
  renderProjection()
  await waitFor(() => expect(screen.getByTestId('display-projection-unavailable')).toBeOnTheScreen())
  expect(screen.getByText('This service is not available right now.')).toBeOnTheScreen()
})
