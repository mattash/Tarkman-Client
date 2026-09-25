import { beforeEach, expect, it, jest } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react-native'
import { StyleSheet, useWindowDimensions } from 'react-native'
import glyphs from '@react-native-vector-icons/ionicons/glyphmaps/Ionicons.json'
import { ReadingFontContext } from '../design/readingFont'
import { colors } from '../design/tokens'
import { ThemeProvider } from '../design/ThemeProvider'
import { I18nProvider, setActiveInterfaceLanguage } from '../features/i18n'
import { DisplayProjection, sessionQrLayout } from '../features/displayLinks/DisplayProjection'
import { useReader } from '../features/live/useReader'
import { initialState } from '../features/live/state'
import type { DisplayLinkConfig } from '../features/displayLinks/config'
import { normalizeSession, normalizeParts, type LivePart, type LiveSession } from '../features/live/contracts'

// Silence the animated sync arrow; it spins a timer this test cannot unmount cleanly.
jest.mock('../features/live/ConnectionStatus', () => ({ ControlConnectionStatus: () => null }))
jest.mock('../features/live/useReader')
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('../features/live/lifecycle', () => ({ lifecycle: { listen: (cb: (a: boolean, o: boolean) => void) => { cb(true, true); return () => {} } } }))

const config: DisplayLinkConfig = {
  token: 'abc', user_id: 7, mode: 'parallel', lang1: 'en', lang2: null,
  show_explanations: false, show_notifications: true, status_view: 'full',
}

beforeEach(() => {
  setActiveInterfaceLanguage('en')
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 })
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
  expect(screen.queryByTestId('display-page-placeholder')).toBeNull()
  expect(screen.queryByTestId('display-posture')).toBeNull()
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

const statusSession = normalizeSession({ session: { id: 42, current_part_id: 1, current_liturgy_part_id: 12 } })
const statusParts = normalizeParts({ parts: [
  { part: { id: 1, liturgy_part_id: 11, page: 99, posture: 'sit' } },
  { part: { id: 1, liturgy_part_id: 12 } },
  { part: { id: 1, liturgy_part_id: 13, page: 24, posture: 'kneel' } },
] })
function setStatus(session: LiveSession | null = statusSession, error: string | null = null) {
  jest.mocked(useReader).mockReturnValue({ saved: null,
    state: { ...initialState, loading: !session, session, parts: statusParts, error },
    retry: jest.fn(), refreshAfterCommand: jest.fn(), dispatch: jest.fn() })
}
function statusTree(overrides: Partial<Parameters<typeof DisplayProjection>[0]> = {}, ready = true, language: 'en' | 'ru' = 'en') {
  return <ThemeProvider scheme="dark"><I18nProvider preference={language}><ReadingFontContext.Provider value={ready}>
    <DisplayProjection apiBase="https://api.test" cableBase="wss://api.test/cable" config={config} sessionId={42} statusOnly {...overrides} />
  </ReadingFontContext.Provider></I18nProvider></ThemeProvider>
}

it('shows standing and a muted, decorative book for missing values, without inventing a page', async () => {
  setStatus()
  await render(statusTree())
  expect(screen.getByLabelText('Stand')).toBeOnTheScreen()
  const placeholder = screen.getByRole('image', { name: 'Page number unavailable' })
  expect(placeholder).toHaveProp('testID', 'display-page-placeholder')
  expect(placeholder.props.tabIndex).toBeUndefined()
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.queryByRole('link')).toBeNull()
  expect(screen.queryByTestId('display-page')).toBeNull()
  expect(screen.queryByText('—')).toBeNull()
  const glyph = screen.getByText(String.fromCodePoint(glyphs['book-outline']))
  expect(glyph).toHaveStyle({ color: colors.dark.muted })
  expect(glyph).toHaveProp('accessible', false)
  expect(glyph.parent).toHaveStyle({ opacity: 0.55 })
  expect(placeholder.props.style).not.toEqual(expect.objectContaining({ opacity: 0.55 }))
  expect(screen.getByTestId('display-posture')).toHaveStyle({ color: colors.dark.foreground })
})

it.each<[string, number, string]>([
  [' sit ', 123, 'Sit'], [' KNEELING ', 2, 'Kneel'], ['unknown', 8, 'No posture indicated'],
])('preserves explicit session instruction %s and page %s over occurrence metadata', async (posture, page, label) => {
  setStatus({ ...statusSession, currentLiturgyPartId: 11, posture, page })
  await render(statusTree())
  expect(screen.getByLabelText(label)).toBeOnTheScreen()
  expect(screen.getByLabelText(`Page ${page}`)).toHaveTextContent(String(page))
  expect(screen.getByTestId('display-page')).toHaveStyle({ color: colors.dark.foreground, fontVariant: ['tabular-nums'] })
  expect(screen.queryByTestId('display-page-placeholder')).toBeNull()
})

it.each<[number, number, number, string]>([
  [1440, 900, 1, 'row'], [390, 844, 1, 'column'], [820, 1180, 3, 'column'],
])('swaps missing → occurrence → missing without retaining values or moving slots at %s × %s / %s', async (width, height, fontScale, direction) => {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height, scale: 1, fontScale })
  setStatus()
  const view = await render(statusTree())
  const slot = screen.getByTestId('display-page-placeholder').parent!
  const slotStyle = StyleSheet.flatten(slot.props.style)
  const layoutStyle = StyleSheet.flatten(slot.parent!.props.style)
  expect(layoutStyle.flexDirection).toBe(direction)
  const glyph = screen.getByText(String.fromCodePoint(glyphs['book-outline']))
  const glyphStyle = StyleSheet.flatten(glyph.props.style)
  expect(glyphStyle.width).toBe(glyphStyle.fontSize + 2)
  expect(glyphStyle.width).toBeLessThan(Math.min(width, height) * 0.4)
  setStatus({ ...statusSession, currentLiturgyPartId: 13, posture: ' \t ', page: -1 })
  await view.rerender(statusTree())
  expect(screen.getByLabelText('Kneel')).toBeOnTheScreen()
  expect(screen.getByLabelText('Page 24')).toHaveTextContent('24')
  expect(screen.queryByTestId('display-page-placeholder')).toBeNull()
  expect(screen.getByTestId('display-page').parent!.props.style).toEqual(slot.props.style)
  setStatus({ ...statusSession, currentLiturgyPartId: 11, posture: null, page: 0 })
  await view.rerender(statusTree())
  expect(screen.getByLabelText('Sit')).toBeOnTheScreen()
  expect(screen.getByLabelText('Page 99')).toBeOnTheScreen()
  setStatus()
  await view.rerender(statusTree())
  expect(screen.getByLabelText('Stand')).toBeOnTheScreen()
  expect(screen.queryByTestId('display-page')).toBeNull()
  const restored = screen.getByTestId('display-page-placeholder').parent!
  expect(StyleSheet.flatten(restored.props.style)).toEqual(slotStyle)
  expect(StyleSheet.flatten(restored.parent!.props.style)).toEqual(layoutStyle)
  expect(statusSession.posture).toBeNull()
  expect(statusParts[1].page).toBeNull()
})

it.each([true, false])('respects minimal mode slots with statusOnly=%s', async statusOnly => {
  setStatus()
  const view = await render(statusTree({ statusOnly, config: { ...config, status_view: 'pages_only' } }))
  expect(screen.getByTestId('display-page-placeholder')).toBeOnTheScreen()
  expect(screen.queryByTestId('display-posture')).toBeNull()
  await view.rerender(statusTree({ statusOnly, config: { ...config, status_view: 'posture_only' } }))
  expect(screen.getByLabelText('Stand')).toBeOnTheScreen()
  expect(screen.queryByTestId('display-page-placeholder')).toBeNull()
  expect(screen.queryByTestId('display-page')).toBeNull()
})

it.each<[LiveSession | null, string | null, boolean, string]>([
  [null, null, false, 'display-projection-loading'],
  [null, 'Missing service', false, 'display-projection-unavailable'],
  [statusSession, null, true, 'display-connection'],
  [statusSession, 'Connection lost', false, 'display-connection'],
])('keeps loading/error notices ahead of defaults (%s, %s, %s)', async (session, error, discoveryError, notice) => {
  setStatus(session, error)
  await render(statusTree({ discoveryError }))
  expect(screen.getByTestId(notice)).toBeOnTheScreen()
  expect(screen.queryByTestId('display-status')).toBeNull()
  expect(screen.queryByTestId('display-page-placeholder')).toBeNull()
  expect(screen.queryByTestId('display-posture')).toBeNull()
})

it.each<['en' | 'ru', string, string]>([
  ['en', 'Page number unavailable', 'Stand'], ['ru', 'Номер страницы недоступен', 'Встаньте'],
])('keeps one localized image announcement while fonts load (%s)', async (language, label, stand) => {
  setStatus()
  const view = await render(statusTree({}, false, language))
  expect(screen.getByRole('image', { name: label })).toBeOnTheScreen()
  const fallback = screen.getByText(label, { includeHiddenElements: true })
  expect(fallback.props.accessible).toBe(false)
  expect(fallback.props.importantForAccessibility).toBe('no')
  expect(StyleSheet.flatten(fallback.props.style).color).toBe(colors.dark.muted)
  expect(screen.queryByText(String.fromCodePoint(glyphs['book-outline']))).toBeNull()
  await view.rerender(statusTree({}, true, language))
  expect(screen.getAllByRole('image', { name: label })).toHaveLength(1)
  expect(screen.getByText(String.fromCodePoint(glyphs['book-outline']))).toBeOnTheScreen()
  expect(screen.getByLabelText(stand)).toBeOnTheScreen()
  expect(!!screen.queryByText(label, { includeHiddenElements: true })).toBe(false)
})

it.each(['en', 'ru'] as const)('renders the web reader QR and caption in %s on two displays and recovers after stop', async language => {
  const session = normalizeSession({ session: { id: 42, status: 'showing_session_qr', current_part_id: 1, current_liturgy_part_id: 11 } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, liturgy_part_id: 11, en: 'Peace unto all.' } }] })
  const result = { saved: null, state: { ...initialState, loading: false, session, parts }, retry: jest.fn(), refreshAfterCommand: jest.fn(), dispatch: jest.fn() }
  jest.mocked(useReader).mockReturnValue(result)
  const pair = () => <ThemeProvider><I18nProvider preference={language}><DisplayProjection apiBase="https://api.test" cableBase="wss://api.test/cable" config={config} sessionId={42} /><DisplayProjection apiBase="https://api.test" cableBase="wss://api.test/cable" config={config} sessionId={42} /></I18nProvider></ThemeProvider>
  const view = await render(pair())
  expect(view.getAllByTestId('display-session-qr')).toHaveLength(2)
  expect(view.getAllByLabelText('https://web.tarkman.app/sessions/42/parts')).toHaveLength(2)
  expect(view.getAllByText('https://web.tarkman.app/sessions/42/parts')).toHaveLength(2)
  expect(view.queryByText('Peace unto all.')).toBeNull()
  jest.mocked(useReader).mockReturnValue({ ...result, state: { ...result.state, session: { ...session, status: 'active' } } })
  await view.rerender(pair())
  expect(view.queryByTestId('display-session-qr')).toBeNull()
  expect(view.getAllByText('Peace unto all.')).toHaveLength(2)
})

it('keeps the reading when QR overlays are disabled by display preferences', async () => {
  const session = normalizeSession({ session: { id: 42, status: 'showing_session_qr', current_part_id: 1, current_liturgy_part_id: 11 } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, liturgy_part_id: 11, en: 'Peace unto all.' } }] })
  jest.mocked(useReader).mockReturnValue({ saved: null, state: { ...initialState, loading: false, session, parts }, retry: jest.fn(), refreshAfterCommand: jest.fn(), dispatch: jest.fn() })
  await renderProjection({ config: { ...config, show_notifications: false } })
  expect(screen.queryByTestId('display-session-qr')).toBeNull()
  expect(screen.getByText('Peace unto all.')).toBeOnTheScreen()
  await renderProjection({ config: { ...config, status_view: 'none' } })
  expect(screen.queryByTestId('display-session-qr')).toBeNull()
  expect(screen.getByText('Peace unto all.')).toBeOnTheScreen()
})

it.each([[1280, 720], [1920, 1080], [390, 844]] as [number, number][])('keeps QR title, quiet zone and URL inside %d×%d', async (width, height) => {
  jest.mocked(useWindowDimensions).mockReturnValue({ width, height, scale: 1, fontScale: 1 })
  const session = normalizeSession({ session: { id: 42, status: 'showing_session_qr', current_part_id: 1, current_liturgy_part_id: 11 } })
  jest.mocked(useReader).mockReturnValue({ saved: null, state: { ...initialState, loading: false, session, parts: [] },
    retry: jest.fn(), refreshAfterCommand: jest.fn(), dispatch: jest.fn() })
  await renderProjection()
  const screenPadding = StyleSheet.flatten(screen.getByTestId('display-session-qr').props.style)
  const horizontal = Number(screenPadding.paddingHorizontal), vertical = Number(screenPadding.paddingVertical)
  const qr = sessionQrLayout(width, height, 1, horizontal, vertical)
  expect(qr.size).toBeGreaterThan(width >= 1280 ? 400 : 250)
  expect(qr.quietZone).toBeGreaterThanOrEqual(16)
  expect(qr.size + 2 * qr.quietZone + 2 * horizontal).toBeLessThanOrEqual(width)
  expect(qr.size + 2 * qr.quietZone + qr.titleLineHeight + qr.captionLineHeight + 2 * 24 + 16 + 2 * vertical).toBeLessThanOrEqual(height)
  expect(screen.getByTestId('display-session-qr')).toBeOnTheScreen()
  expect(screen.getByText('Scan to read along')).toHaveStyle({ lineHeight: qr.titleLineHeight })
  expect(screen.getByText('https://web.tarkman.app/sessions/42/parts')).toHaveStyle({ lineHeight: qr.captionLineHeight })
})
