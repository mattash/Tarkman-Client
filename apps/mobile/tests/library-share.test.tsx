import { afterEach, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native'
import { Platform, Share, View } from 'react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { spacing } from '../design/tokens'
import { AppModal } from '../components/AppModal'
import { ShareServiceButton } from '../features/library/ShareService'
import { libraryShare } from '../features/library/share'
import { platformShare, shareableUrl } from '../features/displayLinks/share'
import { deferred, memoryStore } from './library-test-helpers'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { LibraryProvider } from '../features/library/LibraryProvider'
import { LiturgyReader } from '../features/library/LiturgyReader'
import { createLibrary } from '../features/library/downloadCoordinator'
import { parseBundle, parseCatalog } from '../features/library/contracts'
import fixture from './fixtures/public_liturgies/bundle.json'
import catalog from './fixtures/public_liturgies/catalog.json'
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: '701' }), router: { canGoBack: () => false, replace: jest.fn() },
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}))
jest.mock('../features/library/store', () => ({ libraryStore: { durable: false } }))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
const url = 'https://web.tarkman.app/liturgies/701', name = 'Evening Prayer'
const originalPlatform = Platform.OS
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
afterEach(() => {
  Platform.OS = originalPlatform; jest.restoreAllMocks(); jest.useRealTimers()
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  else Reflect.deleteProperty(globalThis, 'navigator')
})
async function card() { return render(<ThemeProvider><ShareServiceButton id={701} name={name} /></ThemeProvider>) }
it('keeps display sharing closed to Library links', async () => {
  expect(shareableUrl(url)).toBe(false)
  await expect(platformShare.share(url, name, '')).resolves.toBe('copy')
  await expect(platformShare.copy(url)).resolves.toBe(false)
})
it('anchors iOS sharing and quietly handles dismissal and missing anchors', async () => {
  Platform.OS = 'ios'
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction })
  await expect(libraryShare.share(url, name, 'Read', 42)).resolves.toBe('cancelled')
  expect(share).toHaveBeenCalledWith({ title: name, message: 'Read', url }, { subject: name, anchor: 42 })
  await expect(libraryShare.share(url, name, 'Read')).resolves.toBe('copy')
  expect(share).toHaveBeenCalledTimes(1)
})
it('puts the URL in the Android message text', async () => {
  Platform.OS = 'android'
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction })
  await card()
  await fireEvent.press(screen.getByLabelText(`Share ${name}`))
  expect(share.mock.calls[0][0]).toMatchObject({ title: name, message: `Read ${name} in the Tarkman Prayer Library.\n${url}` })
  expect(screen.queryByText('Link copied.')).toBeNull()
})
it('invokes Web Share immediately and cancels silently', async () => {
  Platform.OS = 'web'
  const share = jest.fn<(data: ShareData) => Promise<void>>().mockRejectedValue(Object.assign(new Error(), { name: 'AbortError' }))
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { share } })
  const pending = libraryShare.share(url, name, 'Read')
  expect(share).toHaveBeenCalledWith({ title: name, text: 'Read', url })
  await expect(pending).resolves.toBe('cancelled')
  await card()
  await fireEvent.press(screen.getByLabelText(`Share ${name}`))
  expect(screen.queryByText('Link copied.')).toBeNull()
})
it('locks repeated taps while the share sheet is pending', async () => {
  const pending = deferred<'done' | 'cancelled' | 'copy'>()
  const share = jest.spyOn(libraryShare, 'share').mockReturnValue(pending.promise)
  await card()
  const button = screen.getByLabelText(`Share ${name}`)
  await fireEvent.press(button); await fireEvent.press(button)
  expect(share).toHaveBeenCalledTimes(1)
  expect(button).toBeDisabled()
  await act(async () => pending.resolve('cancelled'))
  expect(screen.queryByText('Link copied.')).toBeNull()
})
it.each([false, true])('copies when Web Share is unavailable or fails (%s)', async fails => {
  Platform.OS = 'web'
  const copy = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
  const share = jest.fn<() => Promise<void>>().mockRejectedValue(new Error('unavailable'))
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { ...(fails ? { share } : {}), clipboard: { writeText: copy } } })
  await card()
  await fireEvent.press(screen.getByLabelText(`Share ${name}`))
  await waitFor(() => expect(screen.getByText('Link copied.')).toBeTruthy())
  expect(copy).toHaveBeenCalledWith(url)
  expect(screen.getByText('Link copied.')).toHaveProp('accessibilityLiveRegion', 'polite')
})
it('clears the pinned confirmation after five seconds', async () => {
  jest.useFakeTimers()
  jest.spyOn(libraryShare, 'share').mockResolvedValue('copy')
  jest.spyOn(libraryShare, 'copy').mockResolvedValue(true)
  await card()
  await fireEvent.press(screen.getByLabelText(`Share ${name}`))
  expect(screen.getByText('Link copied.')).toBeTruthy()
  await act(async () => { jest.advanceTimersByTime(4999) })
  expect(screen.getByText('Link copied.')).toBeTruthy()
  await act(async () => { jest.advanceTimersByTime(1) })
  expect(screen.queryByText('Link copied.')).toBeNull()
})
it('offers selectable manual copy and restores focus to its own opener', async () => {
  Platform.OS = 'web'
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} })
  await card()
  const button = screen.getByLabelText(`Share ${name}`)
  await fireEvent.press(button)
  const text = await screen.findByText(url)
  expect(text).toHaveProp('selectable', true)
  await fireEvent.press(screen.getByLabelText('Close Copy manually'))
  expect(screen.queryByText(url)).toBeNull()
})
it('returns manual-copy focus to the supplied share opener', async () => {
  Platform.OS = 'web'
  const focus = jest.fn()
  await render(<ThemeProvider><AppModal visible title="Copy manually" onDismiss={() => {}} openerRef={{ current: { focus } as unknown as View }} /></ThemeProvider>)
  await fireEvent(screen.getByTestId('app-modal'), 'dismiss')
  expect(focus).toHaveBeenCalledTimes(1)
})

it('pads the reader link-copied notice away from the screen edge', async () => {
  jest.spyOn(libraryShare, 'share').mockResolvedValue('copy')
  jest.spyOn(libraryShare, 'copy').mockResolvedValue(true)
  const api = { catalog: jest.fn(async () => parseCatalog(catalog)), bundle: jest.fn(async () => parseBundle(fixture)) }
  const controller = createLibrary('test', api, memoryStore())
  const preferences = { get: async () => null, set: async () => {}, remove: async () => {} }
  await render(<ThemeProvider><PreferencesProvider store={preferences}><LibraryProvider controller={controller}><LiturgyReader /></LibraryProvider></PreferencesProvider></ThemeProvider>)
  await fireEvent.press(await screen.findByTestId('library-reader-share'))
  const notice = await screen.findByText('Link copied.')
  expect(notice.parent).toHaveStyle({ paddingHorizontal: spacing.page })
  expect(within(screen.getByTestId('library-reader-details')).queryByText('Link copied.')).toBeNull()
})

it('pins the reader copy confirmation outside its scrolling details and hides sharing after revocation', async () => {
  jest.spyOn(libraryShare, 'share').mockResolvedValue('copy')
  jest.spyOn(libraryShare, 'copy').mockResolvedValue(true)
  const api = { catalog: jest.fn(async () => parseCatalog(catalog)), bundle: jest.fn(async () => parseBundle(fixture)) }
  const controller = createLibrary('test', api, memoryStore())
  const preferences = { get: async () => null, set: async () => {}, remove: async () => {} }
  await render(<ThemeProvider><PreferencesProvider store={preferences}><LibraryProvider controller={controller}><LiturgyReader /></LibraryProvider></PreferencesProvider></ThemeProvider>)
  const share = await screen.findByTestId('library-reader-share')
  expect(share).toHaveProp('accessibilityLabel', `Share ${fixture.liturgy.name}`)
  await fireEvent.press(share)
  await waitFor(() => expect(screen.getByText('Link copied.')).toBeTruthy())
  expect(within(screen.getByTestId('library-reader-details')).queryByText('Link copied.')).toBeNull()
  expect(within(screen.getByTestId('library-reader-toolbar')).getByTestId('library-reader-share')).toBeTruthy()
  await act(async () => { await controller.remove(701, true) })
  expect(screen.queryByTestId('library-reader-share')).toBeNull()
  expect(screen.queryByText('Link copied.')).toBeNull()
})
