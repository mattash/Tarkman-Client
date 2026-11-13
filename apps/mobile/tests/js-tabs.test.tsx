import { beforeEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { JsTabsNavigator } from '../components/JsTabsNavigator'
import { ThemeProvider } from '../design/ThemeProvider'

const mockEmit = jest.fn<(event: object) => { defaultPrevented: boolean }>(() => ({ defaultPrevented: false }))
const mockNavigate = jest.fn<(key: string) => void>()
jest.mock('expo-router', () => ({
  Tabs: Object.assign(({ tabBar }: { tabBar: (props: object) => React.ReactNode }) => tabBar({
    state: { index: 0, routes: [{ name: 'index', key: 'today-key' }, { name: 'live', key: 'live-key' }] },
    emitter: { emit: mockEmit }, navigateToTab: mockNavigate,
  }), { Screen: () => null }),
}))
beforeEach(() => { mockEmit.mockClear(); mockNavigate.mockClear(); mockEmit.mockReturnValue({ defaultPrevented: false }) })
const show = () => render(<ThemeProvider><JsTabsNavigator tabs={[
  { name: 'index', label: 'Today', icon: 'tab-today' }, { name: 'live', label: 'Services', icon: 'tab-services' },
]} /></ThemeProvider>)
it('uses SDK 58 route keys and preserves preventable tab presses', async () => {
  await show()
  await fireEvent.press(screen.getByRole('tab', { name: 'Services' }))
  expect(mockEmit).toHaveBeenCalledWith({ type: 'tabPress', target: 'live-key', canPreventDefault: true })
  expect(mockNavigate).toHaveBeenCalledWith('live-key')
  mockNavigate.mockClear(); mockEmit.mockReturnValue({ defaultPrevented: true })
  await fireEvent.press(screen.getByRole('tab', { name: 'Services' }))
  expect(mockNavigate).not.toHaveBeenCalled()
})
it('emits reselection without navigating again', async () => {
  await show()
  await fireEvent.press(screen.getByRole('tab', { name: 'Today' }))
  expect(mockEmit).toHaveBeenCalledWith({ type: 'tabPress', target: 'today-key', canPreventDefault: true })
  expect(mockNavigate).not.toHaveBeenCalled()
})
