import { afterEach, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { DayResult } from '@tarkman/lectionary'
import { ThemeProvider } from '../design/ThemeProvider'
import * as lectionary from '../features/lectionary'
import { LectionaryPicker } from '../features/services/management/LectionaryPicker'
import { EMPTY_OPTIONS, type SessionDraft } from '../features/services/management/draft'
import { deferred } from './auth-helpers'

const initial: SessionDraft = { date: '2026-06-01', liturgies: [], options: { ...EMPTY_OPTIONS, gospel: 'Manual Gospel' } }
afterEach(() => { jest.restoreAllMocks() })
function picker(draft: SessionDraft, onApply = jest.fn(() => true)) {
  return <ThemeProvider scheme="light"><LectionaryPicker draft={draft} editable onApply={onApply} /></ThemeProvider>
}

it('never applies a late lookup over a changed draft and requires a fresh preview', async () => {
  const result = await lectionary.getLectionaryDay(initial.date, 'en')
  const pending = deferred<DayResult>()
  jest.spyOn(lectionary, 'getLectionaryDay').mockReturnValueOnce(pending.promise)
  const onApply = jest.fn(() => true)
  const view = await render(picker(initial, onApply))
  await fireEvent.press(screen.getByRole('button', { name: 'Preview readings for this date' }))
  await view.rerender(picker({ ...initial, options: { ...initial.options, gospel: 'New manual edit' } }, onApply))
  await act(async () => pending.resolve(result))
  expect(screen.getByText('The draft changed since this preview. Refresh before applying readings.')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Apply selected readings' })).toBeDisabled()
  expect(onApply).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh preview' }))
  await fireEvent.press(await screen.findByRole('checkbox', { name: 'Matthew 10.26-33' }))
  expect(screen.getByText('Current: New manual edit')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Apply selected readings' }))
  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ gospel: 'New manual edit' }) }), { gospel: 'Matthew 10.26-33' })
})

it('ignores an older response after dismissing and opening a different date', async () => {
  const older = await lectionary.getLectionaryDay(initial.date, 'en')
  const pending = deferred<DayResult>()
  jest.spyOn(lectionary, 'getLectionaryDay').mockReturnValueOnce(pending.promise)
  const view = await render(picker(initial))
  await fireEvent.press(screen.getByRole('button', { name: 'Preview readings for this date' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Close Lectionary readings' }))
  await view.rerender(picker({ ...initial, date: '2026-01-26' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Preview readings for this date' }))
  expect(await screen.findByText('No readings are appointed for this date. Your existing reading fields will stay unchanged.')).toBeOnTheScreen()
  await act(async () => pending.resolve(older))
  expect(screen.queryByRole('checkbox', { name: 'Matthew 10.26-33' })).toBeNull()
  expect(screen.getByText('2026-01-26')).toBeOnTheScreen()
})

it('selects Classical Armenian content explicitly and preserves canonical display order', async () => {
  const lookup = jest.spyOn(lectionary, 'getLectionaryDay')
  const onApply = jest.fn(() => true)
  await render(picker(initial, onApply))
  await fireEvent.press(screen.getByRole('radio', { name: 'Reading language, Classical Armenian' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Preview readings for this date' }))
  await fireEvent.press(await screen.findByRole('checkbox', { name: 'Աւետարան ըստ Մատթէոսի 10.26-33' }))
  expect(lookup).toHaveBeenCalledWith(initial.date, 'hy')
  await fireEvent.press(screen.getByRole('button', { name: 'Apply selected readings' }))
  expect(onApply).toHaveBeenCalledWith(initial, { gospel: 'Աւետարան ըստ Մատթէոսի 10.26-33' })
})

it.each(['2030-10-04', '2026-02-29'])('keeps manual entry available when lookup is unavailable for %s', async date => {
  const onApply = jest.fn(() => true)
  await render(picker({ ...initial, date }, onApply))
  await fireEvent.press(screen.getByRole('button', { name: 'Preview readings for this date' }))
  expect(await screen.findByText(/manually/)).toBeOnTheScreen()
  expect(screen.queryByRole('button', { name: 'Apply selected readings' })).toBeNull()
  expect(onApply).not.toHaveBeenCalled()
})

it('reports a load failure and a guarded apply rejection without changing the draft', async () => {
  jest.spyOn(lectionary, 'getLectionaryDay').mockResolvedValueOnce({ ok: false, reason: 'data-load', detail: 'missing-pack' })
  const onApply = jest.fn(() => false)
  await render(picker(initial, onApply))
  await fireEvent.press(screen.getByRole('button', { name: 'Preview readings for this date' }))
  expect(await screen.findByText('These readings could not be loaded. Try again or enter readings manually.')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh preview' }))
  await fireEvent.press(await screen.findByRole('checkbox', { name: 'Matthew 10.26-33' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Apply selected readings' }))
  expect(screen.getByText('The draft changed since this preview. Refresh before applying readings.')).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Apply selected readings' })).toBeDisabled()
})
