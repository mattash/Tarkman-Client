import type { ComponentProps } from 'react'
import type { KeyValueAdapter } from '@tarkman/core'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { LibraryProvider } from '../features/library/LibraryProvider'
import { LiturgyReader } from '../features/library/LiturgyReader'
import { createLibrary } from '../features/library/downloadCoordinator'
import { createReadingMetadataStore, type PassageAnchor } from '../features/library/readingMetadata'
import { LibraryError, parseBundle } from '../features/library/contracts'
import type { PartList } from '../features/live/PartList'
import type { AppModal } from '../components/AppModal'
import fixture from './fixtures/public_liturgies/bundle.json'
import { memoryStore, ticks } from './library-test-helpers'

let mockParts: ComponentProps<typeof PartList>
let mockSheet: ComponentProps<typeof AppModal>
jest.mock('expo-router', () => ({ useCanGoBack: () => true,
  router: { canGoBack: () => true, push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ id: '701', environment: 'test' }),
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}))
jest.mock('../features/library/store', () => ({ libraryStore: { durable: false } }))
jest.mock('../features/live/PartList', () => ({ PartList: (props: ComponentProps<typeof PartList>) => {
  mockParts = props
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  return <View testID="mock-parts">{props.header}</View>
} }))
jest.mock('../components/AppModal', () => ({ AppModal: (props: ComponentProps<typeof AppModal>) => {
  if (props.onAfterDismiss) mockSheet = props
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  return props.visible ? <View>{props.children}</View> : null
} }))
const bundle = parseBundle(fixture)
const target: PassageAnchor = { liturgyId: 701, revision: bundle.revision, language: 'en', liturgyPartId: 902, partId: 801, occurrenceIndex: 1, start: 1, end: 4 }
function keyValue() {
  const values = new Map<string, string>()
  const adapter: KeyValueAdapter = {
    get: jest.fn(async key => values.get(key) ?? null),
    set: jest.fn(async (key, value) => { values.set(key, value) }),
    remove: jest.fn(async key => { values.delete(key) }),
  }
  return { values, adapter }
}
async function setup(saved: { resume?: PassageAnchor; bookmarks?: PassageAnchor[]; readFailure?: boolean; unsupported?: boolean; offlineMissing?: boolean } = {}) {
  const { adapter, values } = keyValue(), metadata = createReadingMetadataStore(adapter), store = memoryStore()
  const content = saved.unsupported ? parseBundle({ ...fixture, languages_available: [...fixture.languages_available, 'hy_east'], parts: fixture.parts.map(part => ({ ...part, text: { ...part.text, hy_east: 'Peace' } })) }) : bundle
  const api = { catalog: jest.fn(), bundle: jest.fn(async () => content) }
  const controller = createLibrary('test', api, store, () => 1000, metadata)
  if (!saved.offlineMissing) await controller.request(701, true)
  if (saved.resume) await metadata.saveResume({ environment: 'test', liturgyId: 701 }, saved.resume)
  for (const anchor of saved.bookmarks ?? []) await metadata.addBookmark({ environment: 'test', liturgyId: 701 }, anchor)
  api.bundle.mockRejectedValue(new LibraryError('network'))
  api.bundle.mockClear()
  jest.mocked(adapter.set).mockClear()
  const preferences = keyValue().adapter
  await preferences.set('tarkman.preferences.v1', JSON.stringify({ language: 'en', selectedLanguages: ['en', 'grabar'], readingSize: 'standard', appearance: 'light' }))
  const wrapper = ({ children }: { children: React.ReactNode }) => <GestureHandlerRootView><ThemeProvider scheme="light"><PreferencesProvider store={preferences}><LibraryProvider controller={controller}>{children}</LibraryProvider></PreferencesProvider></ThemeProvider></GestureHandlerRootView>
  if (saved.readFailure) jest.mocked(adapter.get).mockRejectedValueOnce(new Error('metadata read failed'))
  const view = await render(<LiturgyReader />, { wrapper })
  await waitFor(() => expect(screen.getByTestId(saved.offlineMissing ? 'library-saved-open' : 'mock-parts')).toBeTruthy())
  await act(async () => { await ticks() })
  return { controller, adapter, metadata, values, api, view }
}
async function visible(anchor = target, manual = false) {
  await act(async () => {
    if (manual) mockParts.manual()
    mockParts.passageVisible?.({ key: `library:${anchor.liturgyPartId}`, language: anchor.language as 'en', start: anchor.start, end: anchor.end })
    await ticks()
  })
}
async function closeSheet() {
  await act(async () => { mockSheet.onDismiss(); await ticks() })
  await act(async () => { mockSheet.onAfterDismiss?.(); await ticks() })
}

test('offline bookmark captures exact repeated occurrence, opens after modal dismissal, and removes', async () => {
  const { controller, api, adapter } = await setup()
  await visible()
  await fireEvent.press(screen.getByTestId('library-saved-open'))
  await fireEvent.press(screen.getByRole('button', { name: 'Bookmark this passage' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Passage 1 · English' })).toBeTruthy())
  expect((await controller.reading.read(701)).value.bookmarks).toEqual([target])
  await fireEvent.press(screen.getByRole('button', { name: 'Passage 1 · English' }))
  expect(mockParts.passageJump).toBeUndefined()
  await act(async () => { mockSheet.onAfterDismiss?.(); await ticks() })
  expect(mockParts.passageJump).toMatchObject({ key: 'library:902', language: 'en', start: 1, end: 4, focus: true })
  await fireEvent.press(screen.getByTestId('library-saved-open'))
  await fireEvent.press(screen.getByRole('button', { name: 'Remove passage 1' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Passage 1 · English' })).toBeNull())
  expect((await controller.reading.read(701)).value.bookmarks).toEqual([])
  expect(api.bundle).not.toHaveBeenCalled()
  expect(JSON.stringify(jest.mocked(adapter.set).mock.calls)).not.toContain('Peace')
})

test('reopened reader offers saved resume and initial top layout does not overwrite it', async () => {
  const { controller, adapter, view } = await setup({ resume: target })
  await visible({ ...target, liturgyPartId: 901, occurrenceIndex: 0, start: 0, end: 1 })
  expect(screen.getByTestId('library-resume')).toBeTruthy()
  expect(adapter.set).not.toHaveBeenCalled()
  expect((await controller.reading.read(701)).value.resume).toEqual(target)
  await fireEvent.press(screen.getByTestId('library-resume'))
  expect(mockParts.passageJump).toMatchObject({ key: 'library:902', start: 1, end: 4 })
  await view.rerender(<></>)
  await view.rerender(<LiturgyReader />)
  await waitFor(() => expect(screen.getByTestId('library-resume')).toBeTruthy())
  expect((await controller.reading.read(701)).value.resume).toEqual(target)
})

test.each([
  { ...target, revision: 'unavailable-revision' },
  { ...target, liturgyPartId: 999999 },
])('unavailable saved address is removable but never jumps (%#)', async unavailable => {
  const { controller, api } = await setup({ resume: unavailable, bookmarks: [unavailable] })
  expect(screen.getByTestId('library-resume').props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(screen.getByTestId('library-saved-open'))
  expect(screen.getByRole('button', { name: 'Passage 1 · English' }).props.accessibilityState.disabled).toBe(true)
  expect(screen.getByText(/This passage is unavailable/)).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Remove passage 1' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Passage 1 · English' })).toBeNull())
  expect(mockParts.passageJump).toBeUndefined()
  expect((await controller.reading.read(701)).value.resume).toEqual(unavailable)
  expect(api.bundle).not.toHaveBeenCalled()
})

test.each(['remove', 'revoke', 'all'] as const)('%s closes an open reader, cancels pending resume and never auto-requests', async action => {
  const { controller, api } = await setup()
  jest.useFakeTimers()
  await visible(target, true)
  const staleProps = mockParts
  await act(async () => {
    if (action === 'revoke') { api.bundle.mockRejectedValueOnce(new LibraryError('unavailable')); await controller.request(701, true) }
    else await controller.remove(action === 'all' ? undefined : 701)
  })
  expect(screen.queryByTestId('library-reader')).toBeNull()
  expect(screen.getByText('This service is no longer available.')).toBeTruthy()
  await act(async () => {
    staleProps.passageVisible?.({ key: 'library:902', language: 'en', start: 1, end: 4 })
    jest.advanceTimersByTime(600)
    await ticks()
  })
  jest.useRealTimers()
  expect((await controller.reading.read(701)).value).toEqual({ version: 1, resume: null, bookmarks: [] })
  expect(api.bundle).toHaveBeenCalledTimes(action === 'revoke' ? 1 : 0)
})

test('clearing the reading position cancels pending capture and unmount never recreates it', async () => {
  const { controller, view } = await setup({ resume: target, bookmarks: [target] })
  jest.useFakeTimers()
  await visible(target, true)
  await fireEvent.press(screen.getByTestId('library-saved-open'))
  await fireEvent.press(screen.getByRole('button', { name: 'Clear reading position' }))
  await act(async () => { jest.advanceTimersByTime(600); await ticks() })
  expect((await controller.reading.read(701)).value.resume).toBeNull()
  await view.rerender(<></>)
  expect((await controller.reading.read(701)).value).toEqual({ version: 1, resume: null, bookmarks: [target] })
  jest.useRealTimers()
})

test('initial metadata read failure warns but prevents auto-overwrite until explicit successful retry', async () => {
  const { controller, adapter } = await setup({ resume: target, readFailure: true })
  expect(screen.getByText('Couldn’t save reading changes on this device. You can keep reading.')).toBeTruthy()
  jest.useFakeTimers()
  const next = { ...target, liturgyPartId: 901, occurrenceIndex: 0, start: 0, end: 1 }
  await visible(next, true)
  await act(async () => { jest.advanceTimersByTime(600); await ticks() })
  expect(adapter.set).not.toHaveBeenCalled()
  expect((await controller.reading.read(701)).value.resume).toEqual(target)
  await fireEvent.press(screen.getByTestId('library-saved-open'))
  await fireEvent.press(screen.getByRole('button', { name: 'Bookmark this passage' }))
  await act(async () => { await ticks() })
  expect((await controller.reading.read(701)).value).toEqual({ version: 1, resume: target, bookmarks: [next] })
  await visible(next, true)
  await act(async () => { jest.advanceTimersByTime(600); await ticks() })
  expect((await controller.reading.read(701)).value.resume).toEqual(next)
  jest.useRealTimers()
})

test('stale-language callbacks cannot enable bookmarking a passage from a hidden translation', async () => {
  await setup()
  await visible()
  await act(async () => { mockParts.switchLanguage?.('grabar') })
  await visible(target)
  await fireEvent.press(screen.getByTestId('library-saved-open'))
  expect(screen.getByRole('button', { name: 'Bookmark this passage' }).props.accessibilityState.disabled).toBe(true)
  await visible({ ...target, language: 'grabar' })
  expect(screen.getByRole('button', { name: 'Bookmark this passage' }).props.accessibilityState.disabled).toBe(false)
})

test('unsupported wire-language anchor remains removable even when its source exists', async () => {
  const unsupported = { ...target, language: 'hy_east' as const }
  const { controller } = await setup({ resume: unsupported, bookmarks: [unsupported], unsupported: true })
  expect(screen.getByTestId('library-resume').props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(screen.getByTestId('library-saved-open'))
  expect(screen.getByRole('button', { name: /Passage 1/ }).props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(screen.getByRole('button', { name: 'Remove passage 1' }))
  await waitFor(() => expect((screen.queryByRole('button', { name: /Passage 1/ }))).toBeNull())
  expect((await controller.reading.read(701)).value.bookmarks).toEqual([])
  expect(mockParts.passageJump).toBeUndefined()
})

test('missing offline content still lists unavailable metadata and supports remove/clear without another fetch', async () => {
  const { controller, api } = await setup({ resume: target, bookmarks: [target], offlineMissing: true })
  expect(screen.queryByTestId('library-reader')).toBeNull()
  await fireEvent.press(screen.getByTestId('library-saved-open'))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Passage 1 · English' })).toBeTruthy())
  expect(screen.getByRole('button', { name: 'Passage 1 · English' }).props.accessibilityState.disabled).toBe(true)
  expect(screen.getByText(/This passage is unavailable/)).toBeTruthy()
  const calls = api.bundle.mock.calls.length
  await fireEvent.press(screen.getByRole('button', { name: 'Remove passage 1' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Clear reading position' }))
  await act(async () => { await ticks() })
  expect((await controller.reading.read(701)).value).toEqual({ version: 1, resume: null, bookmarks: [] })
  expect(api.bundle).toHaveBeenCalledTimes(calls)
})

test('language and reading-size changes preserve source anchors without stale-language jumps', async () => {
  const { controller } = await setup({ resume: target, bookmarks: [{ ...target, language: 'grabar', start: 0, end: 3 }] })
  await visible()
  await fireEvent.press(screen.getByTestId('library-reader-preferences'))
  await fireEvent.press(screen.getByRole('radio', { name: 'Reading size, Large' }))
  expect(mockParts.readingSize).toBe('larger')
  expect(mockParts.passageJump).toMatchObject({ key: 'library:902', language: 'en', start: 1, end: 4 })
  await closeSheet()
  await fireEvent.press(screen.getByTestId('library-saved-open'))
  await fireEvent.press(screen.getByRole('button', { name: 'Passage 1 · Գրաբար' }))
  await act(async () => { mockSheet.onAfterDismiss?.(); await ticks() })
  expect(mockParts.language).toBe('grabar')
  expect(mockParts.passageJump).toMatchObject({ key: 'library:902', language: 'grabar', start: 0, end: 3 })
  await act(async () => { mockParts.switchLanguage?.('en') })
  expect(mockParts.language).toBe('en')
  expect(mockParts.passageJump).toBeUndefined()
  expect((await controller.reading.read(701)).value.bookmarks[0].language).toBe('grabar')
})
