import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { createPolledResource, InvalidDisplayLinkError, type Lifecycle } from '@tarkman/reader'

function fakeLifecycle() {
  let listener: ((active: boolean, online: boolean) => void) | undefined
  const lifecycle: Lifecycle = { listen: next => { listener = next; return () => { listener = undefined } } }
  return { lifecycle, set: (active: boolean, online: boolean) => listener?.(active, online) }
}
beforeEach(() => { jest.useFakeTimers() })
afterEach(() => { jest.useRealTimers() })

it('polls only while active and online, and keeps the last value beside a transient error', async () => {
  const { lifecycle, set } = fakeLifecycle()
  const load = jest.fn<(signal: AbortSignal) => Promise<string>>().mockResolvedValueOnce('one').mockRejectedValueOnce(new Error('offline')).mockResolvedValue('three')
  const resource = createPolledResource(load, 1000, lifecycle)
  const stop = resource.start()
  expect(load).not.toHaveBeenCalled()
  set(true, true)
  await jest.advanceTimersByTimeAsync(0)
  expect(resource.getSnapshot()).toEqual({ data: 'one' })
  await jest.advanceTimersByTimeAsync(1000)
  expect(resource.getSnapshot().data).toBe('one')
  expect(resource.getSnapshot().error?.message).toBe('offline')
  await jest.advanceTimersByTimeAsync(1000)
  expect(resource.getSnapshot()).toEqual({ data: 'three' })
  set(true, false)
  const calls = load.mock.calls.length
  await jest.advanceTimersByTimeAsync(5000)
  expect(load.mock.calls.length).toBe(calls)
  stop()
})

it('clears the value on a terminal invalid link so cached content cannot look valid', async () => {
  const { lifecycle, set } = fakeLifecycle()
  const load = jest.fn<(signal: AbortSignal) => Promise<string>>().mockResolvedValueOnce('one').mockRejectedValue(new InvalidDisplayLinkError('gone'))
  const resource = createPolledResource(load, 1000, lifecycle)
  const stop = resource.start()
  set(true, true)
  await jest.advanceTimersByTimeAsync(0)
  await jest.advanceTimersByTimeAsync(1000)
  expect(resource.getSnapshot().data).toBeUndefined()
  expect(resource.getSnapshot().error).toBeInstanceOf(InvalidDisplayLinkError)
  stop()
})

it('bounds an unresponsive request so a kiosk cannot stall', async () => {
  const { lifecycle, set } = fakeLifecycle()
  const load = jest.fn<(signal: AbortSignal) => Promise<string>>().mockImplementation(() => new Promise(() => {}))
  const resource = createPolledResource(load, 1000, lifecycle)
  const stop = resource.start()
  set(true, true)
  await jest.advanceTimersByTimeAsync(12001)
  expect(resource.getSnapshot().error?.message).toBe('timeout')
  stop()
})
