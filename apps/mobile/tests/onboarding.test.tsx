import { it, expect, jest } from '@jest/globals'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { AppState, View } from 'react-native'
import { AppButton } from '../components/AppButton'
import { AppText } from '../components/AppText'
import { ThemeProvider } from '../design/ThemeProvider'
import { OnboardingProvider, useOnboarding } from '../features/onboarding/OnboardingProvider'
import { initialOnboarding, readOnboarding, tipEligible, ONBOARDING_KEY } from '../features/onboarding/state'
import { Help } from '../features/onboarding/Help'
import { useReaderEducation } from '../features/onboarding/useReaderEducation'
import { useRef } from 'react'

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() }, useFocusEffect: (effect: () => void) => {
  jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect])
} }))
const store = () => ({ get: jest.fn<(key: string) => Promise<string | null>>(async () => null), set: jest.fn<(key: string, value: string) => Promise<void>>(async () => {}), remove: jest.fn(async () => {}) })
function Probe() {
  const o = useOnboarding()
  return <><AppText testID="state">{JSON.stringify({ ...o.record, ready: o.ready, automatic: o.automatic })}</AppText>
    <AppButton onPress={() => o.update({ cardDismissed: true })}>dismiss</AppButton>
    <AppButton onPress={() => o.update({ status: 'skipped', suppressed: true })}>skip</AppButton></>
}
const state = () => JSON.parse(screen.getByTestId('state').props.children)

it('validates persisted data and preserves learned topics', () => {
  for (const raw of ['{', '{}', JSON.stringify({ ...initialOnboarding, schema: 9 }), JSON.stringify({ ...initialOnboarding, used: ['fake'] })]) {
    expect(readOnboarding(raw)).toEqual(initialOnboarding)
  }
  expect(readOnboarding(JSON.stringify({ ...initialOnboarding, cardDismissed: true, used: ['return'] }))).toMatchObject({ cardDismissed: true, used: ['return'] })
})
it('suppresses learned or skipped tips, allowing deferred return help after completion', () => {
  expect(tipEligible(initialOnboarding, 'return', false)).toBe(true)
  expect(tipEligible(initialOnboarding, 'return', true)).toBe(false)
  expect(tipEligible({ ...initialOnboarding, suppressed: true }, 'return', false)).toBe(false)
  expect(tipEligible({ ...initialOnboarding, status: 'completed' }, 'explanation', false)).toBe(false)
  expect(tipEligible({ ...initialOnboarding, status: 'completed' }, 'return', false)).toBe(true)
  expect(tipEligible({ ...initialOnboarding, used: ['return'] }, 'return', false)).toBe(false)
})
it('late hydration cannot overwrite a dismissal and writes stay ordered', async () => {
  const s = store()
  let resolve!: (value: string | null) => void
  s.get.mockImplementation(() => new Promise(done => { resolve = done }))
  await render(<ThemeProvider><OnboardingProvider store={s}><Probe /></OnboardingProvider></ThemeProvider>)
  await fireEvent.press(screen.getByText('dismiss'))
  await fireEvent.press(screen.getByText('skip'))
  await act(async () => resolve(JSON.stringify(initialOnboarding)))
  await waitFor(() => expect(state()).toMatchObject({ ready: true, cardDismissed: true, status: 'skipped' }))
  expect(s.set.mock.calls.map(call => JSON.parse(call[1]).status)).toEqual(['notStarted', 'skipped'])
  expect(s.set.mock.calls.every(call => call[0] === ONBOARDING_KEY)).toBe(true)
})
it('failed reads suppress automatic prompts without blocking help', async () => {
  const s = store(); s.get.mockRejectedValue(new Error('unavailable'))
  await render(<ThemeProvider><OnboardingProvider store={s}><Probe /><Help card /></OnboardingProvider></ThemeProvider>)
  await waitFor(() => expect(state()).toMatchObject({ ready: true, automatic: false }))
  await fireEvent.press(screen.getByText('How to use the app'))
  expect(screen.getByText('Open a liturgy')).toBeTruthy()
  expect(screen.getByText(/interactive tour is available/)).toBeTruthy()
})
it('dismisses the Today card persistently while keeping help accessible', async () => {
  const s = store()
  const first = await render(<ThemeProvider><OnboardingProvider store={s}><Help card /></OnboardingProvider></ThemeProvider>)
  await waitFor(() => expect(screen.getByText('Learn the basics')).toBeTruthy())
  await fireEvent.press(screen.getByText('Dismiss this tip'))
  await waitFor(() => expect(s.set).toHaveBeenCalled())
  const saved = s.set.mock.calls.at(-1)![1]
  await first.unmount(); s.get.mockResolvedValue(saved)
  await render(<ThemeProvider><OnboardingProvider store={s}><Help card /></OnboardingProvider></ThemeProvider>)
  await waitFor(() => expect(screen.getByText('How to use the app')).toBeTruthy())
  expect(screen.queryByText('Learn the basics')).toBeNull()
})
function ReaderProbe({ healthy = true, sheetOpen = false, following = true }: { healthy?: boolean; sheetOpen?: boolean; following?: boolean }) {
  const root = useRef<View>(null)
  const e = useReaderEducation({ id: 1, healthy, ready: true, available: false, sheetOpen, following, root,
    targets: { follow: root, language: root, explanation: root, preferences: root }, layoutVersion: '1', open: jest.fn() })
  return <View ref={root}>{e.invitationView}{e.overlay}{e.hintView}<Probe />
    <AppButton onPress={() => e.browseStarted()}>browse</AppButton><AppButton onPress={e.replay}>replay</AppButton>
    <AppButton onPress={e.sheetDismissed}>sheet dismissed</AppButton></View>
}
it('offers a nonmodal invitation once, and Not now suppresses automatic education', async () => {
  await render(<ThemeProvider><OnboardingProvider store={store()}><ReaderProbe /></OnboardingProvider></ThemeProvider>)
  await waitFor(() => expect(screen.getByText('Start tour')).toBeTruthy())
  expect(screen.queryByTestId('reader-coachmark')).toBeNull()
  await fireEvent.press(screen.getByText('Not now'))
  expect(state()).toMatchObject({ invitationPresented: true, suppressed: true, status: 'skipped' })
  expect(screen.queryByText('Start tour')).toBeNull()
})
it('never offers a live invitation in an unhealthy reader', async () => {
  await render(<ThemeProvider><OnboardingProvider store={store()}><ReaderProbe healthy={false} /></OnboardingProvider></ThemeProvider>)
  await waitFor(() => expect(state().ready).toBe(true))
  expect(screen.queryByText('Start tour')).toBeNull()
  expect(state().invitationPresented).toBe(false)
})
it('pauses an explicit tour on background and preserves its checkpoint', async () => {
  let change!: (state: import('react-native').AppStateStatus) => void
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { change = listener; return { remove: jest.fn() } })
  await render(<ThemeProvider><OnboardingProvider store={store()}><ReaderProbe /></OnboardingProvider></ThemeProvider>)
  await waitFor(() => expect(screen.getByText('Start tour')).toBeTruthy())
  await fireEvent.press(screen.getByText('Start tour'))
  await fireEvent.press(screen.getByText('Next'))
  expect(state().checkpoint).toBe('language')
  await act(async () => change('background'))
  expect(screen.queryByText('Next')).toBeNull()
  expect(state().status).toBe('inProgress')
  await act(async () => change('active'))
  expect(screen.queryByText('Next')).toBeNull()
  jest.restoreAllMocks()
})

it('requires a real browse gesture and settlement before showing return help', async () => {
  jest.useFakeTimers()
  const s = store(); s.get.mockResolvedValue(JSON.stringify({ ...initialOnboarding, invitationPresented: true }))
  const view = (following: boolean, healthy = true) => <ThemeProvider><OnboardingProvider store={s}><ReaderProbe following={following} healthy={healthy} /></OnboardingProvider></ThemeProvider>
  const rendered = await render(view(false))
  await act(async () => { await Promise.resolve(); jest.advanceTimersByTime(500) })
  expect(screen.queryByText('Reading at your own pace')).toBeNull()
  await fireEvent.press(screen.getByText('browse'))
  await act(async () => jest.advanceTimersByTime(349))
  expect(screen.queryByText('Reading at your own pace')).toBeNull()
  await act(async () => jest.advanceTimersByTime(1))
  expect(screen.getByText('Reading at your own pace')).toBeTruthy()
  await fireEvent.press(screen.getByText('Dismiss this tip'))
  expect(state().dismissed).toEqual(['return'])
  await fireEvent.press(screen.getByText('browse'))
  await act(async () => jest.advanceTimersByTime(500))
  expect(screen.queryByText('Reading at your own pace')).toBeNull()
  await rendered.rerender(view(false, false))
  await fireEvent.press(screen.getByText('browse'))
  await act(async () => jest.advanceTimersByTime(500))
  expect(screen.queryByText('Reading at your own pace')).toBeNull()
  await rendered.unmount(); jest.useRealTimers()
})
it('does not show a queued return hint after live health is lost', async () => {
  jest.useFakeTimers()
  const s = store(); s.get.mockResolvedValue(JSON.stringify({ ...initialOnboarding, invitationPresented: true }))
  const view = (healthy: boolean) => <ThemeProvider><OnboardingProvider store={s}><ReaderProbe following={false} healthy={healthy} /></OnboardingProvider></ThemeProvider>
  const rendered = await render(view(true))
  await act(async () => { await Promise.resolve() })
  await fireEvent.press(screen.getByText('browse'))
  await rendered.rerender(view(false))
  await act(async () => jest.advanceTimersByTime(1000))
  expect(screen.queryByText('Reading at your own pace')).toBeNull()
  expect(state().presented).toEqual([])
  await rendered.unmount(); jest.useRealTimers()
})
it('manual replay preserves automatic suppression and feature choices', async () => {
  const s = store(); s.get.mockResolvedValue(JSON.stringify({ ...initialOnboarding, status: 'skipped', suppressed: true, used: ['language'] }))
  await render(<ThemeProvider><OnboardingProvider store={s}><ReaderProbe /></OnboardingProvider></ThemeProvider>)
  await waitFor(() => expect(state().ready).toBe(true))
  await fireEvent.press(screen.getByText('replay'))
  await waitFor(() => expect(screen.getByText('Step 1 of 4')).toBeTruthy())
  await fireEvent.press(screen.getByText('Next'))
  await fireEvent.press(screen.getByText('Next'))
  expect(screen.getByText(/Some parts include an explanation/)).toBeTruthy()
  expect(screen.queryByText('Open explanation')).toBeNull()
  await fireEvent.press(screen.getByText('Next'))
  await fireEvent.press(screen.getByText('Finish'))
  expect(state()).toMatchObject({ status: 'completed', suppressed: true, used: ['language'], cardDismissed: true })
  expect(screen.queryByText('Next')).toBeNull()
})
