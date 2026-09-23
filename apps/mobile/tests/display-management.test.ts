import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { createManagementApi, ManagementError } from '../features/displayLinks/managementApi'
import { createManagementController } from '../features/displayLinks/managementController'
import { CREATE_DEFAULTS, changedFields, fieldsOf, parseExpiration, validateDraft } from '../features/displayLinks/draft'
import type { AuthContextValue } from '../features/auth/AuthProvider'
import { link, deferred, flush } from './fixtures/displayLink'
let stop: (() => void) | undefined
beforeEach(() => jest.useFakeTimers())
afterEach(() => { stop?.(); stop = undefined; jest.useRealTimers() })
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
function setup(token: string | null = link.token) {
  const api = { list: jest.fn<ReturnType<typeof createManagementApi>['list']>().mockResolvedValue([link]),
    save: jest.fn<ReturnType<typeof createManagementApi>['save']>().mockResolvedValue({ ...link, config_version: 2, font_scale: 130 }) }
  const controller = createManagementController(api, token); stop = controller.start()
  return { api, controller }
}
it('uses scope=mine, JSON envelopes, partial PATCH and top-level expected_config_version', async () => {
  const request = jest.fn<AuthContextValue['authorizedFetch']>().mockResolvedValueOnce(response([link])).mockResolvedValue(response(link))
  const api = createManagementApi(request), signal = new AbortController().signal
  await api.list(signal); expect(request.mock.calls[0][0]).toBe('/display_links?scope=mine')
  await api.save({ font_scale: 130, margin_percent: 0, expires_at: null, ...{ user_id: 99, token: 'forged' } }, signal, link)
  expect(request.mock.calls[1][0]).toBe('/display_links/token-A')
  expect(JSON.parse(request.mock.calls[1][1]!.body as string)).toEqual({ display_link: { font_scale: 130, margin_percent: 0, expires_at: null }, expected_config_version: 1 })
})
it('decodes 422 field errors and a complete 409 current representation', async () => {
  const request = jest.fn<AuthContextValue['authorizedFetch']>().mockResolvedValueOnce(response({ errors: ['invalid'], errors_by_field: { font_scale: ['too small'] } }, 422))
    .mockResolvedValueOnce(response({ display_link: { ...link, config_version: 2 } }, 409))
  const api = createManagementApi(request), signal = new AbortController().signal
  await expect(api.save({}, signal, link)).rejects.toMatchObject({ status: 422, fields: { font_scale: 'too small' } })
  await expect(api.save({}, signal, link)).rejects.toMatchObject({ status: 409, current: { config_version: 2 } })
})
it('creates with every explicit default and preserves null/zero/legacy hyw on unrelated edits', async () => {
  const { api, controller } = setup(null); await flush(); await controller.save()
  expect(api.save.mock.calls[0][0]).toEqual(CREATE_DEFAULTS)
  const saved = { ...link, lang1: 'hyw' as const, margin_percent: 0 }
  expect(changedFields(saved, { ...fieldsOf(saved), title: 'Hall' })).toEqual({ title: 'Hall' })
  expect(validateDraft({ ...CREATE_DEFAULTS, font_scale: 50, margin_percent: 0 })).toEqual({})
  expect(validateDraft({ ...CREATE_DEFAULTS, font_scale: 201 })).toHaveProperty('font_scale')
  expect(parseExpiration('')).toBeNull(); expect(parseExpiration('2026-02-30T12:00')).toBe('invalid')
})
it('keeps drafts on 409 and requires explicit selected-field reapplication before saving', async () => {
  const { api, controller } = setup(); await flush()
  controller.edit({ font_scale: 130, title: 'My title' })
  api.save.mockRejectedValueOnce(new ManagementError(409, {}, { ...link, config_version: 5, title: 'Their title' }))
  await controller.save(); expect(controller.getSnapshot().draft.title).toBe('My title')
  await controller.save(); expect(api.save).toHaveBeenCalledTimes(1)
  controller.review(['font_scale']); expect(controller.getSnapshot().draft.title).toBe('Their title')
  await controller.save(); expect(api.save.mock.calls[1][0]).toEqual({ font_scale: 130 }); expect(api.save.mock.calls[1][2]?.config_version).toBe(5)
})
it('blocks duplicate taps and fences late account/navigation results', async () => {
  const { api, controller } = setup(); await flush()
  const pending = deferred<typeof link>(); api.save.mockReturnValueOnce(pending.promise)
  controller.edit({ font_scale: 130 }); const first = controller.save(); void controller.save()
  expect(api.save).toHaveBeenCalledTimes(1)
  stop!(); expect(api.save.mock.calls[0][1].aborted).toBe(true)
  pending.resolve({ ...link, config_version: 9 }); await first
  expect(controller.getSnapshot().baseline?.config_version).toBe(1)
})
it.each([403, 404])('removes editability on %s', async status => {
  const { api, controller } = setup(); await flush(); controller.edit({ font_scale: 130 })
  api.save.mockRejectedValueOnce(new ManagementError(status)); await controller.save()
  expect(controller.getSnapshot().unavailable).toBe(true); await controller.save(); expect(api.save).toHaveBeenCalledTimes(1)
})
it('keeps validation drafts, never replays a 401, and reconciles unknown PATCH outcomes', async () => {
  const { api, controller } = setup(); await flush(); controller.edit({ font_scale: 130 })
  api.save.mockRejectedValueOnce(new ManagementError(422, { font_scale: 'Invalid' })); await controller.save()
  expect(controller.getSnapshot().draft.font_scale).toBe(130); expect(controller.getSnapshot().fields.font_scale).toBe('Invalid')
  api.save.mockRejectedValueOnce(Object.assign(new Error(), { name: 'UnauthorizedError' })); await controller.save()
  await jest.advanceTimersByTimeAsync(30000); expect(api.save).toHaveBeenCalledTimes(2)
  api.save.mockRejectedValueOnce(new Error('network')); await controller.save()
  await controller.save(); expect(api.save).toHaveBeenCalledTimes(3)
  await controller.reconcile(); expect(controller.getSnapshot().conflict).toEqual(link)
  controller.review(['font_scale']); expect(controller.getSnapshot().uncertain).toBe(false)
})
it('does not blindly retry an uncertain creation after reconciliation', async () => {
  const { api, controller } = setup(null); await flush(); api.save.mockRejectedValueOnce(new Error('network'))
  await controller.save(); await controller.reconcile(); await controller.save()
  expect(controller.getSnapshot()).toMatchObject({ uncertain: true, reconciled: true })
  expect(api.save).toHaveBeenCalledTimes(1)
})
it('redacts capability URLs and tokens in automatic telemetry metadata', async () => {
  const { redactDisplayCapabilities } = await import('../features/displayLinks/privacy')
  const scrubbed = redactDisplayCapabilities({ message: 'GET https://api.test/display_links/token-A',
    data: { token: 'token-A', display_url: link.display_url, nested: [link.display_url] } })
  expect(JSON.stringify(scrubbed)).not.toContain('token-A')
})
