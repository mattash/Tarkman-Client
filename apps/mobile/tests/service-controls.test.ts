import { expect, it, jest } from '@jest/globals'
import { createServiceControls } from '../features/services/controls'
import { respond } from './auth-helpers'

function controls(response: Response) {
  const authorizedFetch = jest.fn<(path: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => Promise<Response>>().mockResolvedValue(response)
  return { authorizedFetch, commands: createServiceControls(authorizedFetch as never) }
}

it('sends each control command once, with the time the part changed', async () => {
  const { authorizedFetch, commands } = controls(respond(200, { status: 'ok' }))
  await commands.next(9)
  await commands.previous(9)
  await commands.goToPart(9, 52)
  await commands.setStatus(9, 'showing_custom', 'Coffee hour follows')
  expect(authorizedFetch.mock.calls.map(call => `${call[1]?.method} ${call[0]}`)).toEqual([
    'POST /s/9/next.json', 'POST /s/9/prev.json', 'POST /s/9/set_part.json', 'PATCH /s/9/update_status.json',
  ])
  const bodies = authorizedFetch.mock.calls.map(call => JSON.parse(String(call[1]?.body)))
  expect(bodies[0].transitioned_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(bodies[2]).toMatchObject({ part_id: 52 })
  expect(bodies[3]).toEqual({ status: 'showing_custom', status_message: 'Coffee hour follows' })
})

it('explains refused, missing and rejected commands', async () => {
  await expect(controls(respond(403, {})).commands.next(9)).rejects.toThrow('You do not have permission to control this service.')
  await expect(controls(respond(404, {})).commands.next(9)).rejects.toThrow('This service is no longer available.')
  await expect(controls(respond(422, { error: 'Already at the last part' })).commands.next(9)).rejects.toThrow('Already at the last part')
  await expect(controls(respond(500, {})).commands.next(9)).rejects.toThrow('Could not update the service. Please try again.')
})
