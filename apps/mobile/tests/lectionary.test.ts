import { expect, it } from '@jest/globals'
import { getLectionaryDay } from '../features/lectionary'

it('loads the complete bundled day through the Expo adapter without a service request', async () => {
  const result = await getLectionaryDay('2026-06-01', 'hy')
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error(result.reason)
  expect(result.day).toMatchObject({ Date: '2026-06-01', Language: 'hy', Mode: { Tone: 'ԱԿ', Number: 2 } })
  expect(result.day.ReadingsRefs[0].book).toBe('Proverbs')
  expect(result.day.Observances[0]).toMatchObject({ id: 'hripsime_and_her_companions', is_fast: false, is_comm: true })
})

it('reports unavailable coverage without prohibiting a valid manual session date', async () => {
  expect(await getLectionaryDay('2030-10-04', 'en')).toEqual({ ok: false, reason: 'out-of-range' })
  expect(await getLectionaryDay('2026-02-29', 'en')).toEqual({ ok: false, reason: 'invalid-date' })
})
