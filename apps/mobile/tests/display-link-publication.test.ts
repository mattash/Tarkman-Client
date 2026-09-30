import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import type { ManagedDisplayLink } from '@tarkman/core'
import type { AuthContextValue } from '../features/auth/AuthProvider'
import { CREATE_DEFAULTS, publicationSupported } from '../features/displayLinks/draft'
import { createManagementApi, managedLink, ManagementError } from '../features/displayLinks/managementApi'
import { createManagementController } from '../features/displayLinks/managementController'
import { link, flush } from './fixtures/displayLink'

/** The backend's own shared fixture (mattash/Tarkman#459 and #460), copied verbatim. */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const contract = require('./fixtures/backend-459/contract.json') as Record<string, Record<string, unknown>>
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const signal = new AbortController().signal
const listed: ManagedDisplayLink = { ...link, published: false, published_at: null }
let stop: (() => void) | undefined
beforeEach(() => { jest.useFakeTimers() })
afterEach(() => { stop?.(); stop = undefined; jest.useRealTimers() })

function setup(token: string | null, links: ManagedDisplayLink[] = [listed]) {
  const api = {
    revoke: jest.fn<ReturnType<typeof createManagementApi>['revoke']>().mockResolvedValue(undefined),
    list: jest.fn<ReturnType<typeof createManagementApi>['list']>().mockResolvedValue(links),
    save: jest.fn<ReturnType<typeof createManagementApi>['save']>().mockResolvedValue({ ...listed, published: true, published_at: '2026-09-29T20:00:00.000Z' }),
  }
  const controller = createManagementController(api, token); stop = controller.start()
  return { api, controller }
}
const body = (request: jest.Mock<AuthContextValue['authorizedFetch']>, call: number) => JSON.parse(request.mock.calls[call][1]!.body as string)

it('reads published and published_at from the backend fixture, and tolerates an older backend that omits them', () => {
  expect(managedLink(contract.management)).toMatchObject({ token: 'example12345', published: false, published_at: null })
  const { published, published_at, ...older } = contract.management // eslint-disable-line @typescript-eslint/no-unused-vars
  const legacy = managedLink(older)
  expect(legacy).not.toHaveProperty('published')
  expect(legacy).not.toHaveProperty('published_at')
  expect(managedLink({ ...contract.management, published: true, published_at: '2026-09-29T20:00:00.000Z' })).toMatchObject({ published: true, published_at: '2026-09-29T20:00:00.000Z' })
  // Anything that is not a boolean or an ISO string is ignored rather than trusted.
  expect(managedLink({ ...contract.management, published: 'yes', published_at: 5 })).not.toHaveProperty('published')
})

it('keeps publication out of the editable configuration', () => {
  expect(Object.keys(CREATE_DEFAULTS)).not.toContain('published')
})

it('sends published only when changed; a publish-only change carries no expected_config_version', async () => {
  // The reply must describe the link being edited (the client rejects any other token).
  const request = jest.fn<AuthContextValue['authorizedFetch']>().mockImplementation(async () => response({ ...contract.management, token: link.token, config_version: 1 }))
  const api = createManagementApi(request)
  await api.save({ font_scale: 130 }, signal, listed) // nothing about publication
  expect(body(request, 0)).toEqual({ display_link: { font_scale: 130 }, expected_config_version: 1 })
  await api.save({}, signal, listed, true) // publish only
  expect(body(request, 1)).toEqual({ display_link: { published: true } })
  await api.save({ font_scale: 130 }, signal, listed, false) // both: the config edit still needs its revision
  expect(body(request, 2)).toEqual({ display_link: { font_scale: 130, published: false }, expected_config_version: 1 })
  await api.save({ title: 'Hall' }, signal, undefined, true) // creating and publishing
  expect(request.mock.calls[3][1]!.method).toBe('POST')
  expect(body(request, 3)).toEqual({ display_link: { title: 'Hall', published: true } })
})

it('decodes a 422 on published and the stale-conflict payload, both with the new fields', async () => {
  const request = jest.fn<AuthContextValue['authorizedFetch']>()
    .mockResolvedValueOnce(response({ errors: ['x'], errors_by_field: { published: ['requires the owner to have a church name on their profile'] } }, 422))
    .mockResolvedValueOnce(response(contract.conflict, 409))
  const api = createManagementApi(request)
  await expect(api.save({}, signal, listed, true)).rejects.toMatchObject({ status: 422, fields: { published: 'requires the owner to have a church name on their profile' } })
  await expect(api.save({ font_scale: 130 }, signal, listed)).rejects.toMatchObject({ status: 409, current: { config_version: 8, published: false, published_at: null } })
})

it('shows the toggle only when the backend reports publication', () => {
  expect(publicationSupported(listed, [listed])).toBe(true)
  expect(publicationSupported(link, [link])).toBe(false) // older backend: no published field
  expect(publicationSupported(undefined, [link, listed])).toBe(true)
  expect(publicationSupported(undefined, [link])).toBe(false)
  expect(publicationSupported(undefined, [])).toBe(false) // creating the first link: unknown, so hidden
})

it('toggling and toggling back sends nothing; a real change is saved and adopted', async () => {
  const { api, controller } = setup(link.token); await flush()
  controller.setPublished(true)
  expect(controller.getSnapshot().publish).toBe(true)
  controller.setPublished(false) // back to the saved value
  expect(controller.getSnapshot().publish).toBeUndefined()
  await controller.save()
  expect(api.save).not.toHaveBeenCalled()

  controller.setPublished(true)
  await controller.save()
  expect(api.save.mock.calls[0][0]).toEqual({}) // no configuration field changed
  expect(api.save.mock.calls[0][3]).toBe(true)
  expect(controller.getSnapshot()).toMatchObject({ publish: undefined, saved: true, baseline: { published: true } })
})

it('a new link starts unpublished and sends published only when switched on', async () => {
  const first = setup(null); await flush(); await first.controller.save()
  expect(first.api.save.mock.calls[0][3]).toBeUndefined()
  stop!()
  const second = setup(null); await flush()
  second.controller.setPublished(true); await second.controller.save()
  expect(second.api.save.mock.calls[0][3]).toBe(true)
})

it('keeps the 422 next to the toggle and the pending change for a retry', async () => {
  const { api, controller } = setup(link.token); await flush()
  api.save.mockRejectedValueOnce(new ManagementError(422, { published: 'requires the owner to have a church name on their profile' }))
  controller.setPublished(true); await controller.save()
  expect(controller.getSnapshot()).toMatchObject({ publish: true, fields: { published: 'requires the owner to have a church name on their profile' } })
  expect(controller.getSnapshot().saved).toBe(false)
})

it('keeps a pending publication through a conflict review', async () => {
  const { api, controller } = setup(link.token); await flush()
  controller.edit({ font_scale: 130 }); controller.setPublished(true)
  api.save.mockRejectedValueOnce(new ManagementError(409, {}, { ...listed, config_version: 5 }))
  await controller.save()
  controller.review(['font_scale'])
  expect(controller.getSnapshot().publish).toBe(true)
  await controller.save()
  expect(api.save.mock.calls[1][0]).toEqual({ font_scale: 130 })
  expect(api.save.mock.calls[1][3]).toBe(true)
})

it('drops a pending publication the newer baseline already has', async () => {
  const { api, controller } = setup(link.token); await flush()
  controller.edit({ font_scale: 130 }); controller.setPublished(true)
  api.save.mockRejectedValueOnce(new ManagementError(409, {}, { ...listed, config_version: 5, published: true }))
  await controller.save()
  controller.review([])
  expect(controller.getSnapshot().publish).toBeUndefined() // someone else already published it
})
