import { beforeEach, expect, jest, test } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { useScreenKeepAwake, type KeepAwakeAppState } from '../features/keepAwake/useScreenKeepAwake'

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => {}),
  deactivateKeepAwake: jest.fn(async () => {}),
}))

beforeEach(() => { jest.clearAllMocks() })

function appState(initial: 'active' | 'background') {
  const listeners = new Set<(state: 'active' | 'background') => void>()
  const source: KeepAwakeAppState = {
    currentState: initial,
    addEventListener: (_event, listener) => {
      listeners.add(listener as (state: 'active' | 'background') => void)
      return { remove: () => { listeners.delete(listener as (state: 'active' | 'background') => void) } } as ReturnType<KeepAwakeAppState['addEventListener']>
    },
  }
  return { source, change: (state: 'active' | 'background') => listeners.forEach(listener => listener(state)) }
}

test('activates while an attended screen is foregrounded and releases on background and exit', async () => {
  const screen = appState('active')
  const { unmount } = await renderHook(() => useScreenKeepAwake('reader', screen.source))
  await waitFor(() => expect(activateKeepAwakeAsync).toHaveBeenCalledWith('reader'))
  expect(deactivateKeepAwake).not.toHaveBeenCalled()

  await act(async () => { screen.change('background') })
  expect(deactivateKeepAwake).toHaveBeenCalledWith('reader')
  await act(async () => { screen.change('active') })
  expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(2)

  await unmount()
  expect(deactivateKeepAwake).toHaveBeenCalledTimes(2)
})

test('does not acquire a wake lock when the screen mounts in the background', async () => {
  const screen = appState('background')
  const { unmount } = await renderHook(() => useScreenKeepAwake('control', screen.source))
  expect(activateKeepAwakeAsync).not.toHaveBeenCalled()
  await unmount()
  expect(deactivateKeepAwake).not.toHaveBeenCalled()
})
