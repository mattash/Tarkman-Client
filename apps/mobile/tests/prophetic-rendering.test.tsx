import { afterEach, expect, it, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { LiturgyText } from '../components/LiturgyText'
import { ReaderStatusControl } from '../features/live/ReaderStatusControl'
import { normalizeParts, normalizeSession } from '../features/live/contracts'
import { initialState } from '../features/live/state'
import { DEFAULT_DISPLAY_CONFIG } from '../features/displayLinks/config'
import { DisplayPresentation } from '../features/displayLinks/DisplayProjection'
import { setActiveInterfaceLanguage, statusName, translate } from '../features/i18n'

jest.mock('../features/live/lifecycle', () => ({ lifecycle: { listen: () => () => {} } }))
afterEach(() => setActiveInterfaceLanguage('en'))

it('treats prophetic display as a live service, not an unknown status', async () => {
  const session = normalizeSession({ session: { id: 7, status: 'showing_prophetic' } })
  await render(<ThemeProvider><ReaderStatusControl state={{ ...initialState, loading: false, listed: true, connected: true, session }} online retry={() => {}} back={() => {}} /></ThemeProvider>)
  expect(screen.getByTestId('reader-status-control').props.accessibilityLabel).toContain('Live')
  expect(statusName(session.status, 'en')).toBe('Prophetic Reading')
  expect(statusName(session.status, 'ru')).toBe('Пророческое чтение')
})

it.each(['en', 'ru'] as const)('projects prophetic interrupts using the %s catalog', async language => {
  setActiveInterfaceLanguage(language)
  const session = normalizeSession({ session: { id: 7, status: 'showing_prophetic', readings: { prophetic: 'Եսայի / Исаия 1:1' } } })
  const view = await render(<ThemeProvider><DisplayPresentation state={{ ...initialState, loading: false, connected: true, session }} config={DEFAULT_DISPLAY_CONFIG} sessionId={7} preview /></ThemeProvider>)
  expect(screen.getByText(/Եսայի \/ Исаия 1:1/)).toBeOnTheScreen()
  const empty = normalizeSession({ session: { id: 7, status: 'showing_prophetic' } })
  await view.rerender(<ThemeProvider><DisplayPresentation state={{ ...initialState, loading: false, connected: true, session: empty }} config={DEFAULT_DISPLAY_CONFIG} sessionId={7} preview /></ThemeProvider>)
  expect(screen.getByText(translate(language, 'display.prophetic'))).toBeOnTheScreen()
})

it('renders backend-expanded prophetic variable text in Armenian beside English', async () => {
  const session = normalizeSession({ session: { id: 7, status: 'active', current_part_id: 1 } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, variable: true, variable_accessor: 'prophetic', en: 'The vision of Isaiah.', grabar: 'Տեսիլք Եսայեայ։', ru: 'Видение Исаии.' } }] })
  await render(<ThemeProvider><DisplayPresentation state={{ ...initialState, loading: false, connected: true, session, parts }} config={{ ...DEFAULT_DISPLAY_CONFIG, mode: 'parallel', lang1: 'en', lang2: 'grabar' }} sessionId={7} preview /></ThemeProvider>)
  expect(screen.getByText('The vision of Isaiah.')).toBeOnTheScreen()
  expect(screen.getByText('Տեսիլք Եսայեայ։')).toBeOnTheScreen()
  expect(parts[0].text.ru).toBe('Видение Исаии.')
})

it('renders backend-expanded Russian prophetic text with the reader typography', async () => {
  const parts = normalizeParts({ parts: [{ part: { id: 1, variable: true, variable_accessor: 'prophetic', en: 'prophetic', ru: 'Видение Исаии.' } }] })
  await render(<ThemeProvider><LiturgyText language="ru" text={parts[0].text.ru} /></ThemeProvider>)
  expect(screen.getByText('Видение Исаии.')).toBeOnTheScreen()
})
