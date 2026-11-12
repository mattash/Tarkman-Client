import { afterEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Platform, Share } from 'react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { LinkActions } from '../features/displayLinks/LinkActions'
import { platformShare, shareableUrl, type ShareAdapter } from '../features/displayLinks/share'
import { link, deferred } from './fixtures/displayLink'

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
const originalPlatform = Platform.OS
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
afterEach(() => {
  Platform.OS = originalPlatform; jest.restoreAllMocks()
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
})
it('shares the persisted HTTPS capability with an iPad anchor, and treats cancellation quietly', async () => {
  Platform.OS = 'ios'
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction, activityType: undefined })
  await expect(platformShare.share(link.display_url, link.title, 'Read along', 42)).resolves.toBe('cancelled')
  expect(share).toHaveBeenCalledWith({ url: link.display_url, title: link.title, message: 'Read along' }, { subject: link.title, anchor: 42 })
  await expect(platformShare.share(link.display_url, link.title, '', undefined)).resolves.toBe('copy')
  expect(share).toHaveBeenCalledTimes(1)
})
it('invokes web share immediately, offers Copy when absent, and does not report cancellation as failure', async () => {
  Platform.OS = 'web'
  const share = jest.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined)
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { share } })
  const pending = platformShare.share(link.display_url, link.title, 'Read along')
  expect(share).toHaveBeenCalledWith({ title: link.title, text: 'Read along', url: link.display_url }); await pending
  share.mockRejectedValueOnce(Object.assign(new Error(), { name: 'AbortError' }))
  await expect(platformShare.share(link.display_url, link.title, '')).resolves.toBe('cancelled')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} })
  await expect(platformShare.share(link.display_url, link.title, '')).resolves.toBe('copy')
  await expect(platformShare.copy(link.display_url)).resolves.toBe(false)
})
it('guards repeated taps, dirty/expired records and presents selectable manual copy after denial', async () => {
  const pending = deferred<'done' | 'cancelled' | 'copy'>()
  const adapter: ShareAdapter = { share: jest.fn<ShareAdapter['share']>().mockReturnValue(pending.promise), copy: jest.fn<ShareAdapter['copy']>().mockResolvedValue(false) }
  const view = await render(<ThemeProvider><LinkActions link={link} adapter={adapter} /></ThemeProvider>)
  await fireEvent.press(screen.getByLabelText('Share Sanctuary')); await fireEvent.press(screen.getByLabelText('Share Sanctuary'))
  expect(adapter.share).toHaveBeenCalledTimes(1)
  pending.resolve('cancelled')
  await view.rerender(<ThemeProvider><LinkActions link={link} adapter={adapter} /></ThemeProvider>)
  await fireEvent.press(screen.getByLabelText('Copy link for Sanctuary'))
  expect(await screen.findByText(link.display_url)).toHaveProp('selectable', true)
  await view.rerender(<ThemeProvider><LinkActions link={link} disabled adapter={adapter} /></ThemeProvider>)
  expect(screen.getByLabelText('Share Sanctuary')).toBeDisabled()
  await view.rerender(<ThemeProvider><LinkActions link={{ ...link, expires_at: '2000-01-01T00:00:00Z' }} adapter={adapter} /></ThemeProvider>)
  expect(screen.getByLabelText('Share Sanctuary')).toBeDisabled()
})
it('rejects native schemes, credentials, control characters, and JSON endpoint construction', () => {
  expect(shareableUrl(link.display_url)).toBe(true)
  for (const url of ['tarkman://display', 'https://api.test/display_links/token-A', 'https://user:secret@example.test/', 'https://example.test/\n']) expect(shareableUrl(url)).toBe(false)
})
