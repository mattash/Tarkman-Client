import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { createPartsApi, normalizePartDetail, normalizePartExplanation } from '../features/parts/api'
import { normalizeParts, normalizeSession } from '../features/live/contracts'
import { initialState } from '../features/live/state'
import { useReader } from '../features/live/useReader'
import { SessionReader } from '../features/live/SessionReader'
import { publishLivePosition } from '../features/live/livePosition'
import PartDetailScreen from '../app/sessions/[id]/part/[partId]'
import { deferred, fakeApi, respond } from './auth-helpers'
import { clearSwipeableMocks, findSwipeable } from './swipeable-helpers'

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- the hoisted factory can't reference an imported binding
  default: require('./swipeable-helpers').MockSwipeable,
}))

const mockPush = jest.fn()
const mockBack = jest.fn()
let mockParams: Record<string, string> = { id: '9', partId: '52' }
jest.mock('expo-router', () => ({ router: { push: (path: unknown) => mockPush(path), back: () => mockBack(), replace: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => mockParams }))
jest.mock('../features/live/useReader')

const preferences = { get: async () => null, set: async () => {}, remove: async () => {} }
const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light"><PreferencesProvider store={preferences}>{children}</PreferencesProvider></ThemeProvider>
const partBody = { part: { id: 52, role: 'deacon', posture: 'Standing', position: 46, page: 3, grabar: 'Ալէլուիա', translit: 'Alleluia', en: 'Alleluia. Stand up', ru: 'Аллилуйя', hy_east: 'Ալելուիա', hy_west: '   ', explanation_ids: [7, 8] } }

beforeEach(() => {
  jest.clearAllMocks()
  mockParams = { id: '9', partId: '52' }
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test'
  process.env.EXPO_PUBLIC_ACTIONCABLE_URL = 'wss://api.test/cable'
})

it('keeps every language the API offers and drops blank ones', () => {
  const detail = normalizePartDetail(partBody)
  expect(detail).toMatchObject({ id: 52, role: 'deacon', posture: 'Standing', position: 46, explanationIds: [7, 8] })
  expect(detail.texts).toEqual({ grabar: 'Ալէլուիա', translit: 'Alleluia', en: 'Alleluia. Stand up', ru: 'Аллилуйя', hyEast: 'Ալելուիա', hyWest: null })
  expect(normalizePartExplanation({ explanation: { id: 7, title: 'The Gospel procession' } })).toEqual({ id: 7, title: 'The Gospel procession', description: null })
})

it('reads parts and explanations publicly, without credentials', async () => {
  const request = fakeApi({ 'GET /s/9/parts/52.json': () => respond(200, partBody), 'GET /s/9/explanations/7.json': () => respond(200, { explanation: { id: 7, title: 'Why we stand' } }) })
  const api = createPartsApi('https://api.test', request)
  await api.part(9, 52, new AbortController().signal)
  await api.explanation(9, 7, new AbortController().signal)
  expect(request.mock.calls[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' } })
  await expect(createPartsApi('https://api.test', fakeApi({ 'GET /s/9/parts/52.json': () => respond(404, {}) })).part(9, 52, new AbortController().signal)).rejects.toThrow('no longer available')
})

it('shows every language at reading size, with no position and posture above the role', async () => {
  globalThis.fetch = fakeApi({
    'GET /s/9/parts/52.json': () => respond(200, partBody),
    'GET /s/9/explanations/7.json': () => respond(200, { explanation: { id: 7, title: 'Why we stand', description: 'The deacon calls the people to attention.' } }),
    'GET /s/9/explanations/8.json': () => respond(500, {}),
  }) as unknown as typeof fetch
  await render(<PartDetailScreen />, { wrapper })
  expect(await screen.findByText('ԳՐԱԲԱՐ')).toBeOnTheScreen()
  expect(screen.getByTestId('part-role')).toHaveTextContent('deacon')
  expect(screen.getByTestId('part-posture')).toHaveTextContent('Standing')
  expect(screen.queryByText(/46/)).toBeNull()
  // English leads for an English reader, then Grabar, then the rest in order. Blank Western Armenian has no section and no chip.
  expect(screen.getAllByTestId(/^part-text-/).map(node => node.props.testID)).toEqual(['part-text-en', 'part-text-grabar', 'part-text-translit', 'part-text-ru', 'part-text-hyEast'])
  expect(screen.getAllByRole('button', { name: /jumps to/ }).map(node => node.props.accessibilityLabel)).toEqual([
    'English, jumps to English text', 'Classical Armenian, jumps to Classical Armenian text', 'Transliteration, jumps to Transliteration text',
    'Russian, jumps to Russian text', 'Eastern Armenian, jumps to Eastern Armenian text'])
  expect(screen.queryByText('ԱՐԵՒՄՏԱՀԱՅԵՐԷՆ')).toBeNull()
  expect(screen.getByText('Why we stand')).toBeOnTheScreen()
  expect(screen.getByText('Some explanations could not be loaded.')).toBeOnTheScreen()
})

it('keeps Grabar first for a Grabar reader, and a chip jumps without hiding any language', async () => {
  const grabarReader = { ...preferences, get: async () => JSON.stringify({ language: 'grabar', selectedLanguages: ['en', 'grabar'], appearance: 'system', readingSize: 'standard' }) }
  globalThis.fetch = fakeApi({ 'GET /s/9/parts/52.json': () => respond(200, { part: { ...partBody.part, explanation_ids: [] } }) }) as unknown as typeof fetch
  await render(<ThemeProvider scheme="light"><PreferencesProvider store={grabarReader}><PartDetailScreen /></PreferencesProvider></ThemeProvider>)
  await waitFor(() => expect(screen.getAllByTestId(/^part-text-/)[0].props.testID).toBe('part-text-grabar'))
  expect(screen.getAllByTestId(/^part-text-/)[1].props.testID).toBe('part-text-translit')
  await fireEvent.press(screen.getByRole('button', { name: 'Russian, jumps to Russian text' }))
  expect(screen.getAllByTestId(/^part-text-/)).toHaveLength(5)
  expect(screen.getByText('No explanation is available for this part.')).toBeOnTheScreen()
})

it('draws the header from the list before the part loads', async () => {
  mockParams = { ...mockParams, role: 'deacon', posture: 'stand', service: 'Divine Liturgy' }
  const slow = deferred<Response>()
  globalThis.fetch = fakeApi({ 'GET /s/9/parts/52.json': () => slow.promise }) as unknown as typeof fetch
  await render(<PartDetailScreen />, { wrapper })
  expect(screen.getByTestId('part-role')).toHaveTextContent('deacon')
  expect(screen.getByTestId('part-posture')).toHaveTextContent('stand')
  expect(screen.getByLabelText('Loading this part')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Divine Liturgy' })).toBeOnTheScreen()
})

it('explains a part that cannot be loaded, with a retry and a way back', async () => {
  globalThis.fetch = fakeApi({ 'GET /s/9/parts/52.json': () => respond(404, {}) }) as unknown as typeof fetch
  await render(<PartDetailScreen />, { wrapper })
  expect(await screen.findByText('This part is no longer available.')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen()
  // A part that has gone will never load, so the error carries its own way back beside Retry.
  await fireEvent.press(screen.getAllByRole('button', { name: 'Back to the service' }).at(-1)!)
  expect(mockBack).toHaveBeenCalled()
})

describe('return to live', () => {
  const parts = normalizeParts({ parts: [1, 2, 3].map(position => ({ part: { id: 50 + position, liturgy_part_id: position, position, role: ['choir', 'deacon', 'priest'][position - 1] } })) })
  let unpublish = () => {}
  beforeEach(() => { globalThis.fetch = fakeApi({ 'GET /s/9/parts/52.json': () => respond(200, { part: { ...partBody.part, explanation_ids: [] } }) }) as unknown as typeof fetch })
  afterEach(async () => { await act(async () => unpublish()) })

  it('stays away while the service has not moved past the part', async () => {
    mockParams = { ...mockParams, key: 'lp:2' }
    const follow = jest.fn()
    unpublish = publishLivePosition({ sessionId: 9, parts, currentKey: 'lp:2', follow })
    await render(<PartDetailScreen />, { wrapper })
    await screen.findByText('ԳՐԱԲԱՐ')
    expect(screen.queryByTestId('part-return-to-live')).toBeNull()
  })

  it('names where the service went by role, and is dismissed by scrolling', async () => {
    mockParams = { ...mockParams, key: 'lp:2' }
    const follow = jest.fn()
    unpublish = publishLivePosition({ sessionId: 9, parts, currentKey: 'lp:1', follow })
    await render(<PartDetailScreen />, { wrapper })
    await screen.findByText('ԳՐԱԲԱՐ')
    expect(screen.queryByTestId('part-return-to-live')).toBeNull()
    await act(async () => { unpublish = publishLivePosition({ sessionId: 9, parts, currentKey: 'lp:3', follow }) })
    const go = screen.getByRole('button', { name: 'The service is now at Priest. Go there' })
    await fireEvent(screen.getByTestId('part-detail'), 'scrollBeginDrag')
    expect(screen.queryByTestId('part-return-to-live')).toBeNull()
    expect(go).not.toBeOnTheScreen()
  })

  it('goes back to the list and follows the service', async () => {
    mockParams = { ...mockParams, key: 'lp:1' }
    const follow = jest.fn()
    unpublish = publishLivePosition({ sessionId: 9, parts, currentKey: 'lp:2', follow })
    await render(<PartDetailScreen />, { wrapper })
    await fireEvent.press(await screen.findByRole('button', { name: 'The service is now at Deacon. Go there' }))
    expect(follow).toHaveBeenCalled()
    expect(mockBack).toHaveBeenCalled()
  })

  it('never appears for another service or a shared link opened on its own', async () => {
    mockParams = { ...mockParams, key: 'lp:1' }
    unpublish = publishLivePosition({ sessionId: 10, parts, currentKey: 'lp:3', follow: jest.fn() })
    await render(<PartDetailScreen />, { wrapper })
    await screen.findByText('ԳՐԱԲԱՐ')
    expect(screen.queryByTestId('part-return-to-live')).toBeNull()
  })
})

it('opens a part from the reading list', async () => {
  const session = normalizeSession({ session: { id: 9, liturgy: 'Divine Liturgy', current_part_id: 1 } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, position: 1, role: 'Choir', en: 'Lord, have mercy.' } }, { part: { id: 52, position: 46, role: 'deacon', posture: 'stand', en: 'Alleluia. Stand up' } }] })
  jest.mocked(useReader).mockReturnValue({ saved: null, state: { ...initialState, loading: false, stale: false, session, parts }, retry: jest.fn(), dispatch: jest.fn() })
  await render(<SessionReader endpoints={{ api: 'https://api.test', cable: 'wss://api.test/cable' }} id={9} back={jest.fn()} />, { wrapper })
  await fireEvent.press(screen.getByLabelText('deacon'))
  // Role and posture travel with the route; position does not, since readers never see it.
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: '/sessions/[id]/part/[partId]',
    params: { id: '9', partId: '52', key: 'part:52:liturgy:null:position:46', role: 'deacon', service: 'Divine Liturgy', posture: 'stand' } }))
})


afterEach(() => { jest.restoreAllMocks() })

it.each([-80, -220])('opens the swiped part, not the live part, after a %s point swipe', async dx => {
  clearSwipeableMocks()
  const session = normalizeSession({ session: { id: 9, liturgy: 'Divine Liturgy', current_part_id: 1 } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, position: 1, role: 'Choir', en: 'Lord, have mercy.' } }, { part: { id: 52, position: 46, role: 'deacon', en: 'Alleluia. Stand up' } }] })
  jest.mocked(useReader).mockReturnValue({ saved: null, state: { ...initialState, loading: false, stale: false, session, parts }, retry: jest.fn(), dispatch: jest.fn() })
  await render(<SessionReader endpoints={{ api: 'https://api.test', cable: 'wss://api.test/cable' }} id={9} back={jest.fn()} />, { wrapper })
  const instance = findSwipeable('swipe-part:52:liturgy:null:position:46')
  // The row has no measured width here, so the threshold is the 144px floor → 2.0 progress.
  const progress = Math.abs(dx) / 72
  // Gesture lifecycle: start drag clears the peak tracker; the per-frame progress writes then
  // accumulate the maximum; on release willOpen reads the peak and either reveals or triggers.
  await act(async () => { (instance.props['onSwipeableOpenStartDrag'] as () => void)() })
  instance.progress.value = progress
  await act(async () => { (instance.props['onSwipeableWillOpen'] as () => void)() })
  if (dx === -80) {
    expect(mockPush).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: 'View details for deacon' }))
  }
  await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
  expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ partId: '52', role: 'deacon' }) }))
})
