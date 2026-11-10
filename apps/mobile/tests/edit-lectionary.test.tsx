import { expect, it, jest } from '@jest/globals'
import { useSyncExternalStore } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { AuthContextValue } from '../features/auth/AuthProvider'
import { ThemeProvider } from '../design/ThemeProvider'
import { getLectionaryDay } from '../features/lectionary'
import { LectionaryPicker } from '../features/services/management/LectionaryPicker'
import { createEditController, pendingChanges, type EditController } from '../features/services/management/editing'
import { deferred, respond } from './auth-helpers'
import { managedSession } from './fixtures/session-management'

type Fetch = AuthContextValue['authorizedFetch']
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
function setup(...responses: Array<Response | Promise<Response>>) {
  const fetcher = jest.fn<Fetch>()
  for (const response of responses) fetcher.mockReturnValueOnce(Promise.resolve(response))
  return { fetcher, controller: createEditController(fetcher, 4008) }
}
const snapshot = () => respond(200, { schema_version: 1, session: managedSession() })
function EditPicker({ controller }: { controller: EditController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return <ThemeProvider scheme="light"><LectionaryPicker draft={state.draft}
    editable={state.phase === 'editing' && !state.conflict && !state.reset && !state.final} onApply={controller.applyReadings} /></ThemeProvider>
}

it('previews and applies prophetic readings in an edit draft, then persists only on explicit Save', async () => {
  const { fetcher, controller } = setup(snapshot(), respond(200, { session: managedSession({ revision: 18, options: { prophetic: 'Imported' } }) }))
  await controller.load()
  const before = controller.getSnapshot().draft
  const result = await getLectionaryDay(before.date, 'en')
  if (!result.ok) throw Error(result.reason)
  const reference = result.day.ReadingsList[0]
  await render(<EditPicker controller={controller} />)
  await fireEvent.press(screen.getByRole('button', { name: 'Preview readings for this date' }))
  await fireEvent.press(await screen.findByRole('checkbox', { name: `Prophetic reading: ${reference}` }))
  expect(fetcher).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole('button', { name: 'Apply selected readings' }))
  expect(pendingChanges(controller.getSnapshot())).toEqual({ options: { prophetic: reference } })
  expect(controller.getSnapshot().draft.options.gospel).toBe(before.options.gospel)
  expect(fetcher).toHaveBeenCalledTimes(1)
  await act(async () => { controller.save(); await flush() })
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({ expected_revision: 17, session: { options: { prophetic: reference } } })
  controller.dispose()
})

it('applies all selected reading fields in one notification and preserves unrelated draft values', async () => {
  const { controller } = setup(snapshot())
  await controller.load()
  const before = controller.getSnapshot().draft
  const notify = jest.fn()
  controller.subscribe(notify)
  expect(controller.applyReadings(before, { gospel: 'Gospel import', epistle: 'Epistle import', prophetic: 'Prophetic import' })).toBe(true)
  expect(notify).toHaveBeenCalledTimes(1)
  expect(controller.getSnapshot().draft.options).toEqual({ ...before.options, gospel: 'Gospel import', epistle: 'Epistle import', prophetic: 'Prophetic import' })
  controller.dispose()
})

it('rejects empty patches, stale previews and applications before loading or after disposal', async () => {
  const { controller } = setup(snapshot())
  expect(controller.applyReadings(controller.getSnapshot().draft, { prophetic: 'Import' })).toBe(false)
  await controller.load()
  const before = controller.getSnapshot().draft
  expect(controller.applyReadings(before, { prophetic: '' })).toBe(false)
  controller.setOption('prophetic', 'Manual edit')
  expect(controller.applyReadings(before, { prophetic: 'Import' })).toBe(false)
  expect(controller.getSnapshot().draft.options.prophetic).toBe('Manual edit')
  controller.dispose()
  expect(controller.applyReadings(controller.getSnapshot().draft, { prophetic: 'Import' })).toBe(false)
})

it('rejects a preview while saving and while a stale-save conflict awaits review', async () => {
  const pending = deferred<Response>()
  const { controller } = setup(snapshot(), pending.promise)
  await controller.load()
  controller.setOption('prophetic', 'Manual edit')
  const before = controller.getSnapshot().draft
  controller.save()
  expect(controller.applyReadings(before, { prophetic: 'Import' })).toBe(false)
  pending.resolve(respond(409, { code: 'stale_session', session: managedSession({ revision: 18 }) }))
  await flush()
  expect(controller.getSnapshot().conflict).not.toBeNull()
  expect(controller.applyReadings(before, { prophetic: 'Import' })).toBe(false)
  controller.dispose()
})

it('clears selected reading validation errors atomically while retaining unrelated errors', async () => {
  const { controller } = setup(snapshot(), respond(422, { code: 'invalid_session', error: 'invalid_session', errors_by_field: { 'options.prophetic': ['Invalid prophetic'], 'options.gospel': ['Invalid Gospel'], 'options.after_message': ['Invalid message'] } }))
  await controller.load()
  controller.setOption('prophetic', 'Manual')
  controller.save(); await flush()
  expect(controller.getSnapshot().fields).toHaveProperty('prophetic')
  const before = controller.getSnapshot().draft
  expect(controller.applyReadings(before, { prophetic: 'Imported', gospel: 'Imported Gospel' })).toBe(true)
  expect(controller.getSnapshot().fields).not.toHaveProperty('prophetic')
  expect(controller.getSnapshot().fields).not.toHaveProperty('gospel')
  expect(controller.getSnapshot().fields).toHaveProperty('after_message')
  controller.dispose()
})
