import { expect, it, jest } from '@jest/globals'
import { createOpeningConsumer, openingPath } from '../features/siri/openingInvocations'

const invocation = (id = 'one', liturgyId: unknown = '701') => ({ id, name: 'openLiturgy', params: { liturgyId } })

it.each(['1', '701', '9007199254740991'])('opens only canonical safe liturgy %s in the existing reader', id => {
  expect(openingPath(invocation('one', id))).toBe(`/liturgies/${id}`)
})
it.each([undefined, null, 701, ['701'], '', '0', '-1', '007', '1e2', '1.5', '9007199254740992', 'https://evil.example', '701?environment=evil'])('routes invalid payload %s to the existing invalid-target error', id => {
  expect(openingPath({ id: 'one', name: 'openLiturgy', params: { liturgyId: id } })).toBe('/liturgies/invalid')
})
it('ignores other actions, never treating their payloads as navigation', () => {
  expect(openingPath({ ...invocation(), name: 'controlService' })).toBeNull()
})
it('serializes overlapping snapshots, applies each invocation once, and acknowledges after navigation', async () => {
  const events: string[] = []
  const consume = createOpeningConsumer(path => events.push(path), async id => { events.push(`ack:${id}`) })
  await Promise.all([consume([invocation()]), consume([invocation(), invocation('two', '702')])])
  expect(events).toEqual(['/liturgies/701', 'ack:one', 'ack:one', '/liturgies/702', 'ack:two'])
})
it('retries failed acknowledgment without reapplying navigation', async () => {
  const navigate = jest.fn(), acknowledge = jest.fn<() => Promise<void>>()
    .mockRejectedValueOnce(new Error('storage')).mockResolvedValue(undefined)
  const consume = createOpeningConsumer(navigate, acknowledge)
  await consume([invocation()]); await consume([invocation()])
  expect(navigate).toHaveBeenCalledTimes(1)
  expect(acknowledge).toHaveBeenCalledTimes(2)
})
it('does not acknowledge failed navigation and permits retry', async () => {
  const navigate = jest.fn<() => void>().mockImplementationOnce(() => { throw new Error('router') }), acknowledge = jest.fn<(id: string) => Promise<void>>(async () => {})
  const consume = createOpeningConsumer(navigate, acknowledge)
  await consume([invocation()])
  expect(acknowledge).not.toHaveBeenCalled()
  await consume([invocation()])
  expect(navigate).toHaveBeenCalledTimes(2)
  expect(acknowledge).toHaveBeenCalledWith('one')
})
it('acknowledges invalid targets after showing the error route but leaves unknown actions alone', async () => {
  const navigate = jest.fn(), acknowledge = jest.fn<(id: string) => Promise<void>>(async () => {})
  await createOpeningConsumer(navigate, acknowledge)([invocation('bad', '007'), { ...invocation('other'), name: 'other' }])
  expect(navigate).toHaveBeenCalledWith('/liturgies/invalid')
  expect(acknowledge).toHaveBeenCalledTimes(1)
  expect(acknowledge).toHaveBeenCalledWith('bad')
})
