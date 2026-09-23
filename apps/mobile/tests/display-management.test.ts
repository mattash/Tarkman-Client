import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { redactDisplayCapabilities } from '../features/displayLinks/privacy'
import { createManagementApi, ManagementError } from '../features/displayLinks/managementApi'
import { createManagementController } from '../features/displayLinks/managementController'
import { CREATE_DEFAULTS, changedFields, fieldsOf, parseExpiration, validateDraft } from '../features/displayLinks/draft'
import type { AuthContextValue } from '../features/auth/AuthProvider'
import { link, deferred, flush } from './fixtures/displayLink'
let stop: (() => void) | undefined
beforeEach(() => { jest.useFakeTimers() })
afterEach(() => { stop?.(); stop = undefined; jest.useRealTimers() })
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
function setup(token: string | null = link.token) {
  const api = { revoke: jest.fn<ReturnType<typeof createManagementApi>['revoke']>().mockResolvedValue(undefined), list: jest.fn<ReturnType<typeof createManagementApi>['list']>().mockResolvedValue([link]),
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
  expect(parseExpiration('')).toBeNull(); expect(parseExpiration('2026-02-30T12:00')).toBeUndefined()
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
  const scrubbed = redactDisplayCapabilities({ message: 'GET https://api.test/display_links/token-A',
    data: { token: 'token-A', display_url: link.display_url, nested: [link.display_url] } })
  expect(JSON.stringify(scrubbed)).not.toContain('token-A')
})

it('deletes with the authenticated API and accepts an empty 204 response', async () => {
  const request = jest.fn<AuthContextValue['authorizedFetch']>().mockResolvedValue(new Response(null, { status: 204 }))
  const signal = new AbortController().signal
  await createManagementApi(request).revoke('token/A', signal)
  expect(request).toHaveBeenCalledWith('/display_links/token%2FA', { method: 'DELETE', signal })
})
it('revokes once, removes the link, and blocks later writes', async () => {
  const { api, controller } = setup(); await flush()
  const pending = deferred<void>(); api.revoke.mockReturnValueOnce(pending.promise)
  const first = controller.revoke(); await controller.revoke(); await controller.save()
  expect(api.revoke).toHaveBeenCalledTimes(1); expect(api.save).not.toHaveBeenCalled()
  pending.resolve(); await first
  expect(controller.getSnapshot()).toMatchObject({ revoked: true, unavailable: true, saving: false, links: [] })
  await controller.revoke(); expect(api.revoke).toHaveBeenCalledTimes(1)
})
it.each([401, 403, 404])('retains the draft and prevents revoke replay after %s', async status => {
  const { api, controller } = setup(); await flush(); controller.edit({ title: 'Draft' })
  api.revoke.mockRejectedValueOnce(new ManagementError(status)); await controller.revoke()
  expect(controller.getSnapshot()).toMatchObject({ unavailable: true, revoked: false, saving: false, draft: { title: 'Draft' } })
  await controller.revoke(); expect(api.revoke).toHaveBeenCalledTimes(1)
})
it('handles the auth provider 401 signal without retry', async () => {
  const { api, controller } = setup(); await flush()
  api.revoke.mockRejectedValueOnce(Object.assign(new Error(), { name: 'UnauthorizedError' }))
  await controller.revoke(); await controller.revoke()
  expect(controller.getSnapshot().unavailable).toBe(true); expect(api.revoke).toHaveBeenCalledTimes(1)
})
it.each([true, false])('reconciles uncertain revoke without replay (deleted=%s)', async deleted => {
  const { api, controller } = setup(); await flush(); controller.edit({ title: 'Draft' })
  api.revoke.mockRejectedValueOnce(new Error('network')); await controller.revoke(); await controller.revoke()
  expect(controller.getSnapshot()).toMatchObject({ uncertain: true, revokePending: true, draft: { title: 'Draft' } })
  api.list.mockResolvedValueOnce(deleted ? [] : [link]); await controller.reconcile()
  expect(api.revoke).toHaveBeenCalledTimes(1)
  if (deleted) expect(controller.getSnapshot()).toMatchObject({ revoked: true, uncertain: false })
  else {
    expect(controller.getSnapshot().conflict).toEqual(link)
    controller.review(['title']); expect(controller.getSnapshot()).toMatchObject({ uncertain: false, draft: { title: 'Draft' } })
    await controller.revoke(); expect(api.revoke).toHaveBeenCalledTimes(2)
  }
})
it('bounds stalled revoke and fences completion after leaving', async () => {
  const { api, controller } = setup(); await flush()
  const pending = deferred<void>(); api.revoke.mockReturnValueOnce(pending.promise)
  const first = controller.revoke(); await jest.advanceTimersByTimeAsync(12000); await first
  expect(api.revoke.mock.calls[0][1].aborted).toBe(true)
  expect(controller.getSnapshot().uncertain).toBe(true)
  stop!(); pending.resolve(); await flush()
  expect(controller.getSnapshot().revoked).toBe(false)
})
it('clears stale errors on edits while retaining invalid expiration separately', async () => {
  const { api, controller } = setup(); await flush()
  controller.editExpiration('2026-02-30T12:00'); await controller.save()
  expect(controller.getSnapshot()).toMatchObject({ expirationInvalid: true, expirationInput: '2026-02-30T12:00', draft: { expires_at: null } })
  expect(controller.getSnapshot().fields.expires_at).toBeDefined(); expect(api.save).not.toHaveBeenCalled()
  controller.edit({ title: 'Draft' }); expect(controller.getSnapshot().error).toBeUndefined()
  await controller.save(); expect(controller.getSnapshot().fields.expires_at).toBeDefined()
  controller.editExpiration(''); api.save.mockRejectedValueOnce(new ManagementError(422, { title: 'Invalid' })); await controller.save()
  expect(controller.getSnapshot().error).toBeDefined()
  controller.edit({ title: 'Fixed' }); expect(controller.getSnapshot()).toMatchObject({ error: undefined, fields: {}, expirationInvalid: false })
  await controller.save(); expect(api.save.mock.calls[1][0]).toEqual({ title: 'Fixed' })
})
it('redacts plain and multiply stringified cable identifiers without redacting unrelated prose or keys', async () => {
  const identifier = JSON.stringify({ channel: 'DisplayLinkChannel', token: 'capability-value' })
  for (const message of [identifier, JSON.stringify({ identifier }), JSON.stringify(JSON.stringify({ identifier }))]) {
    expect(redactDisplayCapabilities(message)).not.toContain('capability-value')
  }
  for (const text of ['A token is required', '{"token_count":42}', '{"other_token":"example"}', 'DisplayLinkChannel connected']) {
    expect(redactDisplayCapabilities(text)).toBe(text)
  }
})
it.each([401, 403, 404, 500])('keeps DELETE status %s even when its error body is empty or malformed', async status => {
  for (const body of ['', 'not JSON', '{"errors_by_field":"unexpected"}']) {
    const request = jest.fn<AuthContextValue['authorizedFetch']>().mockResolvedValue(new Response(body, { status }))
    await expect(createManagementApi(request).revoke(link.token, new AbortController().signal)).rejects.toMatchObject({ status })
  }
})
it('aborts a pending revoke on navigation and ignores its late success', async () => {
  const { api, controller } = setup(); await flush()
  const pending = deferred<void>(); api.revoke.mockReturnValueOnce(pending.promise)
  const first = controller.revoke(); stop!()
  expect(api.revoke.mock.calls[0][1].aborted).toBe(true)
  pending.resolve(); await first
  expect(controller.getSnapshot()).toMatchObject({ revoked: false, uncertain: true, revokePending: true })
})
it('retains expiration input through reconciliation only when explicitly selected', async () => {
  const { controller } = setup(); await flush()
  controller.editExpiration('bad date'); await controller.reconcile(); controller.review(['expires_at'])
  expect(controller.getSnapshot()).toMatchObject({ expirationInput: 'bad date', expirationInvalid: true, draft: { expires_at: null } })
  await controller.reconcile(); controller.review([])
  expect(controller.getSnapshot()).toMatchObject({ expirationInput: undefined, expirationInvalid: false })
})
