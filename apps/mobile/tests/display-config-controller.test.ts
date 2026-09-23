import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { createConfigController } from '../features/displayLinks/configController'
import { completeConfig, configReducer, initialConfigState } from '../features/displayLinks/configState'
import { InvalidDisplayLinkError } from '../features/displayLinks/api'
import type { CableCallbacks } from '../features/live/cable'
import type { DisplayLinkConfig } from '../features/displayLinks/config'
import { link, deferred, flush } from './fixtures/displayLink'
let callbacks: CableCallbacks, lifecycle: (active: boolean, online: boolean) => void, stop: () => void
beforeEach(() => jest.useFakeTimers())
afterEach(() => { stop?.(); jest.useRealTimers() })
function setup(load = jest.fn<(signal: AbortSignal) => Promise<DisplayLinkConfig>>().mockResolvedValue(link)) {
  const close = jest.fn(), subscribe = jest.fn((_url: string, _id: unknown, cb: CableCallbacks) => { callbacks = cb; return close })
  const controller = createConfigController(link.token, load, { subscribe }, 'wss://example.test/cable', {
    listen(cb) { lifecycle = cb; cb(true, true); return () => {} },
  })
  stop = controller.start()
  return { controller, load, subscribe, close }
}
const event = (version: number, token = link.token) => ({ event: 'display_link.updated', data: { ...link, token, config_version: version, font_scale: 130 } })

it('validates complete public snapshots without requiring private management metadata', () => {
  const publicLink = { ...link, id: undefined, created_at: undefined, display_url: undefined }
  expect(completeConfig(publicLink)).toMatchObject({ config_version: 1 })
  for (const invalid of [{ ...link, font_scale: '130' }, { ...link, lang1: 'ru' }, { ...link, config_version: 1.1 }, { ...link, expires_at: 'bad' }]) expect(completeConfig(invalid)).toBeNull()
})
it('uses versions, accepts gaps, and refuses duplicate/older/versionless snapshots', () => {
  const accepted = configReducer(initialConfigState, { type: 'snapshot', config: { ...link, config_version: 8 } })
  for (const version of [1, 7, 8, undefined]) expect(configReducer(accepted, { type: 'snapshot', config: { ...link, config_version: version } })).toBe(accepted)
  expect(configReducer(accepted, { type: 'snapshot', config: { ...link, config_version: 15 } }).version).toBe(15)
})
it('applies socket before stale HTTP and coalesces confirmation reads to close the bootstrap race', async () => {
  const first = deferred<DisplayLinkConfig>()
  const load = jest.fn<(signal: AbortSignal) => Promise<DisplayLinkConfig>>().mockReturnValueOnce(first.promise).mockResolvedValue({ ...link, config_version: 4 })
  const { controller, subscribe } = setup(load)
  expect(subscribe.mock.calls[0][1]).toEqual({ channel: 'DisplayLinkChannel', token: link.token })
  callbacks.connected(); callbacks.connected(); callbacks.received(event(3))
  expect(controller.getSnapshot().version).toBe(3)
  first.resolve(link); await flush()
  expect(load).toHaveBeenCalledTimes(2)
  expect(controller.getSnapshot().version).toBe(4)
})
it('ignores other tokens and bounds malformed-event refetch bursts', async () => {
  const { load, controller } = setup(); await flush()
  callbacks.received(event(20, 'token-B')); expect(controller.getSnapshot().version).toBe(1)
  for (let i = 0; i < 30; i++) callbacks.received({ event: 'display_link.updated', data: { token: link.token, config_version: 2 } })
  await flush(); expect(load).toHaveBeenCalledTimes(2)
})
it('retains a valid snapshot on transient errors, polls serially, and recovers on confirmation', async () => {
  const { controller, load } = setup(); await flush()
  load.mockRejectedValueOnce(new Error('offline'))
  await jest.advanceTimersByTimeAsync(10000)
  expect(controller.getSnapshot().data).toEqual(link)
  expect(controller.getSnapshot().error).toBeDefined()
  callbacks.connected(); await flush()
  expect(controller.getSnapshot().error).toBeUndefined()
})
it('cancels background/offline work and rejects callbacks from stopped subscriptions', async () => {
  const { controller, load, subscribe, close } = setup(); await flush()
  const old = callbacks
  lifecycle(false, true); expect(close).toHaveBeenCalledTimes(1)
  old.received(event(40)); await jest.advanceTimersByTimeAsync(60000)
  expect(controller.getSnapshot().version).toBe(1); expect(load).toHaveBeenCalledTimes(1)
  lifecycle(true, false); expect(subscribe).toHaveBeenCalledTimes(1)
  lifecycle(true, true); await flush(); expect(subscribe).toHaveBeenCalledTimes(2); expect(load).toHaveBeenCalledTimes(2)
})
it('invalidates terminally and an in-flight response cannot resurrect deleted links', async () => {
  const pending = deferred<DisplayLinkConfig>(), { controller, load } = setup(); await flush()
  load.mockReturnValueOnce(pending.promise); callbacks.connected()
  callbacks.received({ event: 'display_link.invalidated', data: { token: link.token, config_version: 8, reason: 'deleted' } })
  pending.resolve({ ...link, config_version: 9 }); await flush(); callbacks.received(event(10))
  callbacks.received({ event: 'display_link.invalidated', data: { token: link.token, config_version: 11, reason: 'expired' } })
  expect(controller.getSnapshot()).toEqual({ version: 8, terminal: 'deleted' })
})
it('only a fresh canonical validation can restore renewed expired links', async () => {
  const { controller, load } = setup(); await flush()
  load.mockRejectedValueOnce(new InvalidDisplayLinkError('expired', true)); callbacks.connected(); await flush()
  expect(controller.getSnapshot().terminal).toBe('expired')
  const renewed = deferred<DisplayLinkConfig>(); load.mockReturnValueOnce(renewed.promise)
  callbacks.received(event(2)); expect(controller.getSnapshot().terminal).toBe('expired')
  renewed.resolve({ ...link, config_version: 2 }); await flush(); expect(controller.getSnapshot().terminal).toBeUndefined()
})
it('checks natural expiration canonically, and bounds stalled reads', async () => {
  const load = jest.fn<(signal: AbortSignal) => Promise<DisplayLinkConfig>>().mockResolvedValueOnce({ ...link, expires_at: new Date(Date.now() + 2000).toISOString() }).mockImplementation(() => new Promise(() => {}))
  const { controller } = setup(load); await flush()
  await jest.advanceTimersByTimeAsync(2001); expect(load).toHaveBeenCalledTimes(2)
  await jest.advanceTimersByTimeAsync(12000); expect(load.mock.calls[1][0].aborted).toBe(true)
  expect(controller.getSnapshot().data).toBeDefined()
  await jest.advanceTimersByTimeAsync(10000); expect(load).toHaveBeenCalledTimes(3)
})
it('confirmed 404 cannot be undone by later socket snapshots', async () => {
  const { controller, load } = setup(); await flush()
  load.mockRejectedValueOnce(new InvalidDisplayLinkError('missing')); callbacks.connected(); await flush()
  callbacks.received(event(9)); expect(controller.getSnapshot().terminal).toBe('unavailable')
})
