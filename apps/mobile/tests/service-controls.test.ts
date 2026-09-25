import { expect, it, jest } from '@jest/globals'
import { createServiceControls, isControlForbidden, isStalePart } from '../features/services/controls'
import { respond } from './auth-helpers'

function controls(response: Response) {
  const authorizedFetch = jest.fn<(path: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => Promise<Response>>().mockResolvedValue(response)
  return { authorizedFetch, commands: createServiceControls(authorizedFetch as never) }
}

it('sends each control command once, with the time the part changed', async () => {
  const { authorizedFetch, commands } = controls(respond(200, { status: 'ok' }))
  await commands.next(9, 1)
  await commands.previous(9, 1)
  await commands.goToPart(9, 52, 1)
  await commands.setStatus(9, 'showing_custom', 'Coffee hour follows')
  expect(authorizedFetch.mock.calls.map(call => `${call[1]?.method} ${call[0]}`)).toEqual([
    'POST /s/9/next.json', 'POST /s/9/prev.json', 'POST /s/9/set_part.json', 'PATCH /s/9/update_status.json',
  ])
  const bodies = authorizedFetch.mock.calls.map(call => JSON.parse(String(call[1]?.body)))
  expect(bodies[0].transitioned_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(bodies[0]).toMatchObject({ expected_part_id: 1 })
  expect(bodies[2]).toMatchObject({ part_id: 52, expected_part_id: 1 })
  expect(bodies[3]).toEqual({ status: 'showing_custom', status_message: 'Coffee hour follows' })
})

it('omits the expected part when this device does not know it yet', async () => {
  const { authorizedFetch, commands } = controls(respond(200, {}))
  await commands.next(9, null)
  expect(JSON.parse(String(authorizedFetch.mock.calls[0][1]?.body))).not.toHaveProperty('expected_part_id')
})

it('explains refused, missing, stale and rejected commands', async () => {
  await expect(controls(respond(403, {})).commands.next(9, 1)).rejects.toThrow('You do not have permission to control this service.')
  await expect(controls(respond(404, {})).commands.next(9, 1)).rejects.toThrow('This service is no longer available.')
  await expect(controls(respond(422, { error: 'Already at the last part' })).commands.next(9, 1)).rejects.toThrow('Already at the last part')
  await expect(controls(respond(500, {})).commands.next(9, 1)).rejects.toThrow('Could not update the service. Please try again.')
})

it('names the end of the service when the server refuses a move past it', async () => {
  await expect(controls(respond(422, { status: 'Could not advance session', current_part_id: 334 })).commands.next(9, 334))
    .rejects.toThrow('This is the last part. There is nothing after it.')
  await expect(controls(respond(422, { status: 'Could not back session', current_part_id: 1 })).commands.previous(9, 1))
    .rejects.toThrow('This is the first part. There is nothing before it.')
})

it('marks a move the server refused as stale so the screen can resync', async () => {
  const failure = await controls(respond(409, { error: 'The current part changed', current_part_id: 7 })).commands.next(9, 1).catch(error => error)
  expect(isStalePart(failure)).toBe(true)
  expect(String(failure.message)).toMatch(/already moved on/)
  expect(isStalePart(new Error('other'))).toBe(false)
})

it('marks refused permission apart from other failures, and does not ask the operator to look up the part', async () => {
  const forbidden = await controls(respond(403, {})).commands.next(9, 1).catch((failure: Error) => failure)
  expect(isControlForbidden(forbidden)).toBe(true)
  expect(isStalePart(forbidden)).toBe(false)
  const stale = await controls(respond(409, {})).commands.next(9, 1).catch((failure: Error) => failure)
  expect(isStalePart(stale)).toBe(true)
  expect(isControlForbidden(stale)).toBe(false)
  expect((stale as Error).message).toBe('The service already moved on, so nothing was changed.')
})
it('sends revision CAS for navigation and status commands, and returns the committed state rather than optimistic inputs', async () => {
  const publication = { revision: 9, content_context: 'manifest', session_status: 'active', status_message: null,
    posture: 'stand', date: '2026-09-17', cursor: { part_id: 52, liturgy_part_id: 152, liturgy_id: 20, position: 3 } }
  const authorizedFetch = jest.fn<() => Promise<Response>>().mockImplementation(async () => respond(200, {
    status: 'Advanced to next part', current_part_id: 52, ...publication,
  }))
  const commands = createServiceControls(authorizedFetch, 8)
  await expect(commands.next(9, 1)).resolves.toMatchObject({ id: 9, revision: 9, status: 'active', cursor: { liturgyPartId: 152 } })
  await commands.setStatus(9, 'showing_custom', 'Welcome')
  for (const call of authorizedFetch.mock.calls as unknown as [string, { body: string }][]) {
    expect(JSON.parse(call[1].body).expected_revision).toBe(8)
  }
})
it('accepts old successful command responses and lets the reader recover authoritative state', async () => {
  await expect(controls(respond(200, { status: 'Advanced to next part' })).commands.next(9, 1)).resolves.toBeUndefined()
})

it('selects the requested occurrence when a Part is reused', async () => {
  const { authorizedFetch, commands } = controls(respond(200, { status: 'ok' }))
  await commands.goToPart(9, 52, 52, 152)
  expect(JSON.parse(String(authorizedFetch.mock.calls[0][1]?.body))).toMatchObject({ part_id: 52, liturgy_part_id: 152, expected_part_id: 52 })
})

it('sends QR show/stop as revision-aware status commands without message or navigation', async () => {
  const authorizedFetch = jest.fn<() => Promise<Response>>().mockResolvedValue(respond(200, { status: 'success', current_part_id: 1, revision: 6,
    session_status: 'showing_session_qr', status_message: null, posture: null, date: null, content_context: 'v1', cursor: { part_id: 1, liturgy_part_id: 11, liturgy_id: 2, position: 1 } }))
  const commands = createServiceControls(authorizedFetch, 5)
  await expect(commands.setStatus(9, 'showing_session_qr')).resolves.toMatchObject({ status: 'showing_session_qr', revision: 6 })
  await commands.setStatus(9, 'active')
  expect((authorizedFetch.mock.calls as unknown as [string, { body: string }][]).map(([path, init]) => [path, JSON.parse(init.body)]))
    .toEqual([['/s/9/update_status.json', { status: 'showing_session_qr', expected_revision: 5 }],
      ['/s/9/update_status.json', { status: 'active', expected_revision: 5 }]])
})
