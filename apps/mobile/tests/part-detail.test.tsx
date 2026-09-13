import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { PanResponder, type GestureResponderEvent, type PanResponderGestureState } from 'react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { createPartsApi, normalizePartDetail, normalizePartExplanation } from '../features/parts/api'
import { normalizeParts, normalizeSession } from '../features/live/contracts'
import { initialState } from '../features/live/state'
import { useReader } from '../features/live/useReader'
import { SessionReader } from '../features/live/SessionReader'
import PartDetailScreen from '../app/sessions/[id]/part/[partId]'
import { fakeApi, respond } from './auth-helpers'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ router: { push: (path: string) => mockPush(path), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => ({ id: '9', partId: '52' }) }))
jest.mock('../features/live/useReader')

const preferences = { get: async () => null, set: async () => {}, remove: async () => {} }
const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light"><PreferencesProvider store={preferences}>{children}</PreferencesProvider></ThemeProvider>
const partBody = { part: { id: 52, role: 'deacon', posture: 'Standing', position: 46, page: 3, grabar: 'Ալէլուիա', translit: 'Alleluia', en: 'Alleluia. Stand up', ru: 'Аллилуйя', hy_east: 'Ալելուիա', hy_west: '   ', explanation_ids: [7, 8] } }

beforeEach(() => {
  jest.clearAllMocks()
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

it('shows the part in every language with its explanations', async () => {
  globalThis.fetch = fakeApi({
    'GET /s/9/parts/52.json': () => respond(200, partBody),
    'GET /s/9/explanations/7.json': () => respond(200, { explanation: { id: 7, title: 'Why we stand', description: 'The deacon calls the people to attention.' } }),
    'GET /s/9/explanations/8.json': () => respond(500, {}),
  }) as unknown as typeof fetch
  await render(<PartDetailScreen />, { wrapper })
  expect(await screen.findByText('46 / deacon')).toBeOnTheScreen()
  expect(screen.getByText('Posture: Standing')).toBeOnTheScreen()
  for (const label of ['Classical Armenian', 'Transliteration', 'English', 'Russian', 'Eastern Armenian']) expect(screen.getByText(label)).toBeOnTheScreen()
  expect(screen.queryByText('Western Armenian')).toBeNull()
  expect(screen.getByText('Why we stand')).toBeOnTheScreen()
  expect(screen.getByText('Some explanations could not be loaded.')).toBeOnTheScreen()
})

it('explains a part that cannot be loaded and offers a retry', async () => {
  globalThis.fetch = fakeApi({ 'GET /s/9/parts/52.json': () => respond(500, {}) }) as unknown as typeof fetch
  await render(<PartDetailScreen />, { wrapper })
  expect(await screen.findByText('Could not load this part. Please retry.')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen()
})

it('opens a part from the reading list', async () => {
  const session = normalizeSession({ session: { id: 9, liturgy: 'Divine Liturgy', current_part_id: 1 } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, position: 1, role: 'Choir', en: 'Lord, have mercy.' } }, { part: { id: 52, position: 46, role: 'deacon', en: 'Alleluia. Stand up' } }] })
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, session, parts }, retry: jest.fn(), dispatch: jest.fn() })
  await render(<SessionReader endpoints={{ api: 'https://api.test', cable: 'wss://api.test/cable' }} id={9} back={jest.fn()} />, { wrapper })
  await fireEvent.press(screen.getByLabelText('deacon'))
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/sessions/9/part/52'))
})


afterEach(() => { jest.restoreAllMocks() })

it.each([-80, -220])('opens the swiped part, not the live part, after a %s point swipe', async dx => {
  const create = jest.spyOn(PanResponder, 'create')
  const session = normalizeSession({ session: { id: 9, liturgy: 'Divine Liturgy', current_part_id: 1 } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, position: 1, role: 'Choir', en: 'Lord, have mercy.' } }, { part: { id: 52, position: 46, role: 'deacon', en: 'Alleluia. Stand up' } }] })
  jest.mocked(useReader).mockReturnValue({ state: { ...initialState, loading: false, stale: false, session, parts }, retry: jest.fn(), dispatch: jest.fn() })
  await render(<SessionReader endpoints={{ api: 'https://api.test', cable: 'wss://api.test/cable' }} id={9} back={jest.fn()} />, { wrapper })
  const handler = create.mock.calls.at(-1)![0]
  const event = { nativeEvent: { timestamp: 1000 } } as GestureResponderEvent
  const movement = { dx, dy: 0, numberActiveTouches: 1, y0: 100 } as PanResponderGestureState
  handler.onStartShouldSetPanResponderCapture?.(event, movement)
  expect(handler.onMoveShouldSetPanResponderCapture?.(event, movement)).toBe(true)
  await act(async () => {
    handler.onPanResponderGrant?.(event, movement)
    handler.onPanResponderMove?.(event, movement)
    handler.onPanResponderRelease?.(event, movement)
  })
  if (dx === -80) {
    expect(mockPush).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: 'View details for deacon' }))
  }
  expect(mockPush).toHaveBeenCalledTimes(1)
  expect(mockPush).toHaveBeenCalledWith('/sessions/9/part/52')
})
