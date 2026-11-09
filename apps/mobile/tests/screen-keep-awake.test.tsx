import { beforeEach, expect, jest, test } from '@jest/globals'
import { act, renderHook } from '@testing-library/react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import { useScreenKeepAwake, type KeepAwakeAppState } from '../features/keepAwake/useScreenKeepAwake'

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => {}),
  deactivateKeepAwake: jest.fn(async () => {}),
}))

const activate = jest.mocked(activateKeepAwakeAsync)
const deactivate = jest.mocked(deactivateKeepAwake)

beforeEach(() => {
  activate.mockReset().mockResolvedValue(undefined)
  deactivate.mockReset().mockResolvedValue(undefined)
})

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function appState(initial: 'active' | 'background' | 'inactive') {
  const listeners = new Set<(state: 'active' | 'background' | 'inactive') => void>()
  const source: KeepAwakeAppState = {
    currentState: initial,
    addEventListener: (_event, listener) => {
      listeners.add(listener)
      return { remove: () => { listeners.delete(listener) } } as ReturnType<KeepAwakeAppState['addEventListener']>
    },
  }
  return { source, change: (state: 'active' | 'background' | 'inactive') => listeners.forEach(listener => listener(state)) }
}

test('activates in foreground, ignores duplicate events, and releases on background and exit', async () => {
  const screen = appState('active')
  const { unmount } = await renderHook(() => useScreenKeepAwake('reader', screen.source))
  const firstTag = activate.mock.calls[0][0]
  expect(firstTag).toMatch(/^reader:/)
  expect(deactivate).not.toHaveBeenCalled()

  await act(async () => { screen.change('active'); screen.change('active') })
  expect(activate).toHaveBeenCalledTimes(1)
  await act(async () => { screen.change('background') })
  expect(deactivate).toHaveBeenCalledWith(firstTag)
  await act(async () => { screen.change('active') })
  expect(activate).toHaveBeenCalledTimes(2)

  await unmount()
  expect(deactivate).toHaveBeenCalledTimes(2)
  expect(deactivate).toHaveBeenLastCalledWith(activate.mock.calls[1][0])
  await act(async () => { screen.change('active') })
  expect(activate).toHaveBeenCalledTimes(2)
})

test('does not acquire or release when mounted in the background', async () => {
  const screen = appState('background')
  const { unmount } = await renderHook(() => useScreenKeepAwake('control', screen.source))
  expect(activate).not.toHaveBeenCalled()
  await unmount()
  expect(deactivate).not.toHaveBeenCalled()
})

test('waits for delayed acquisition before releasing an immediately unmounted screen', async () => {
  const pending = deferred()
  activate.mockReturnValueOnce(pending.promise)
  const screen = appState('active')
  const { unmount } = await renderHook(() => useScreenKeepAwake('reader', screen.source))
  await unmount()
  expect(deactivate).not.toHaveBeenCalled()
  await act(async () => { pending.resolve() })
  expect(deactivate).toHaveBeenCalledTimes(1)
  expect(deactivate).toHaveBeenCalledWith(activate.mock.calls[0][0])
})

test.each(['mounted', 'unmounted'] as const)('handles denied or unsupported activation while %s without releasing an unacquired tag', async (state) => {
  const pending = deferred()
  activate.mockReturnValueOnce(pending.promise)
  const screen = appState('active')
  const { unmount } = await renderHook(() => useScreenKeepAwake('reader', screen.source))
  if (state === 'unmounted') await unmount()
  await act(async () => { pending.reject(new Error('Wake lock unavailable')) })
  if (state === 'mounted') {
    await act(async () => { screen.change('background'); screen.change('active') })
    expect(activate).toHaveBeenCalledTimes(2)
    expect(deactivate).not.toHaveBeenCalled()
    await unmount()
    expect(deactivate).toHaveBeenCalledTimes(1)
  } else {
    expect(deactivate).not.toHaveBeenCalled()
  }
})

test('discards a superseded acquisition after background and foreground, even out of order', async () => {
  const pending = deferred()
  activate.mockReturnValueOnce(pending.promise)
  const screen = appState('active')
  const { unmount } = await renderHook(() => useScreenKeepAwake('reader', screen.source))
  await act(async () => { screen.change('inactive'); screen.change('background'); screen.change('active') })
  expect(activate).toHaveBeenCalledTimes(2)
  const oldTag = activate.mock.calls[0][0]
  const newTag = activate.mock.calls[1][0]
  expect(newTag).not.toBe(oldTag)
  expect(deactivate).not.toHaveBeenCalled()
  await act(async () => { pending.resolve() })
  expect(deactivate.mock.calls).toEqual([[oldTag]])
  await unmount()
  expect(deactivate.mock.calls).toEqual([[oldTag], [newTag]])
})

test('isolates repeated reader visits from late acquisition and delayed cleanup', async () => {
  const pending = deferred()
  const cleanup = deferred()
  activate.mockReturnValueOnce(pending.promise)
  deactivate.mockReturnValueOnce(cleanup.promise)
  const screen = appState('active')
  const first = await renderHook(() => useScreenKeepAwake('reader', screen.source))
  await first.unmount()
  const second = await renderHook(() => useScreenKeepAwake('reader', screen.source))
  const oldTag = activate.mock.calls[0][0]
  const newTag = activate.mock.calls[1][0]
  expect(newTag).not.toBe(oldTag)
  await act(async () => { pending.resolve() })
  expect(deactivate.mock.calls).toEqual([[oldTag]])
  await act(async () => { cleanup.resolve() })
  await second.unmount()
  expect(deactivate.mock.calls).toEqual([[oldTag], [newTag]])
})

test.each(['acquired', 'pending'] as const)('catches rejected cleanup of a %s acquisition', async (state) => {
  const pending = deferred()
  if (state === 'pending') activate.mockReturnValueOnce(pending.promise)
  deactivate.mockRejectedValueOnce(new Error('Already released'))
  const screen = appState('active')
  const { unmount } = await renderHook(() => useScreenKeepAwake('reader', screen.source))
  await unmount()
  await act(async () => { pending.resolve() })
  expect(deactivate).toHaveBeenCalledTimes(1)
})

test('cleans up the old acquisition when the tag changes', async () => {
  const pending = deferred()
  activate.mockReturnValueOnce(pending.promise)
  const screen = appState('active')
  const { rerender, unmount } = await renderHook<void, { tag: string }>(({ tag }) => useScreenKeepAwake(tag, screen.source), { initialProps: { tag: 'reader' } })
  await rerender({ tag: 'display' })
  expect(activate.mock.calls[1][0]).toMatch(/^display:/)
  await act(async () => { pending.resolve() })
  expect(deactivate.mock.calls).toEqual([[activate.mock.calls[0][0]]])
  await unmount()
  expect(deactivate).toHaveBeenLastCalledWith(activate.mock.calls[1][0])
})
