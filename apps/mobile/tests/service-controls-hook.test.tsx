import { expect, it, jest } from '@jest/globals'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useControls } from '../features/services/useControls'
import { deferred } from './auth-helpers'

jest.mock('../features/live/lifecycle', () => ({ lifecycle: { listen: (callback: (active: boolean, online: boolean) => void) => { callback(true, (globalThis as { __online?: boolean }).__online ?? true); return () => {} } } }))

const setOnline = (online: boolean) => { (globalThis as { __online?: boolean }).__online = online }

it('runs one command at a time and refreshes after it succeeds', async () => {
  setOnline(true)
  const refresh = jest.fn()
  const slow = deferred<void>()
  const command = jest.fn(() => slow.promise)
  const { result } = await renderHook(() => useControls(refresh))
  await act(async () => { void result.current.run('next', command) })
  expect(result.current.running).toBe('next')
  await act(async () => { void result.current.run('previous', command) })
  expect(command).toHaveBeenCalledTimes(1)
  await act(async () => { slow.resolve() })
  await waitFor(() => expect(result.current.running).toBeNull())
  expect(refresh).toHaveBeenCalledTimes(1)
})

it('refuses to send commands while offline', async () => {
  setOnline(false)
  const command = jest.fn(async () => {})
  const { result } = await renderHook(() => useControls(jest.fn()))
  await waitFor(() => expect(result.current.online).toBe(false))
  await act(async () => { await result.current.run('next', command) })
  expect(command).not.toHaveBeenCalled()
  expect(result.current.error).toMatch(/offline/i)
})

it('surfaces a failed command without retrying it', async () => {
  setOnline(true)
  const refresh = jest.fn()
  const command = jest.fn(async () => { throw new Error('Already at the last part') })
  const { result } = await renderHook(() => useControls(refresh))
  await act(async () => { await result.current.run('next', command) })
  expect(command).toHaveBeenCalledTimes(1)
  expect(result.current.error).toBe('Already at the last part')
  expect(result.current.running).toBeNull()
  expect(refresh).not.toHaveBeenCalled()
})
