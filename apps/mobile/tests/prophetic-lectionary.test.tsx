import { afterEach, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { getLectionaryDay, readingReferences, selectedReadings } from '../features/lectionary'
import { LectionaryPicker } from '../features/services/management/LectionaryPicker'
import { EMPTY_OPTIONS, type SessionDraft } from '../features/services/management/draft'

const initial: SessionDraft = { date: '2026-06-01', liturgies: [], options: { ...EMPTY_OPTIONS, prophetic: 'Manual prophetic', gospel: 'Manual Gospel' } }
afterEach(() => { jest.restoreAllMocks() })
function picker(draft: SessionDraft, onApply = jest.fn(() => true)) {
  return <ThemeProvider scheme="light"><LectionaryPicker draft={draft} editable onApply={onApply} /></ThemeProvider>
}

it.each(['en', 'hy'] as const)('offers all %s references for deliberate prophetic assignment without inferring an OT role', async language => {
  const result = await getLectionaryDay(initial.date, language)
  if (!result.ok) throw Error(result.reason)
  const day = result.day
  expect(day.Readings.Prophetic).toBeUndefined()
  expect(day.Readings['Old Testament'].length).toBeGreaterThan(1)
  expect(readingReferences(day, 'prophetic')).toEqual(day.ReadingsList)
  expect(selectedReadings(day, { gospel: [], epistle: [], prophetic: [] })).toEqual({})
  expect(selectedReadings(day, { gospel: [], epistle: [], prophetic: [2, 0] })).toEqual({ prophetic: [day.ReadingsList[0], day.ReadingsList[2]].join('; ') })
  expect(() => selectedReadings(day, { gospel: [], epistle: [], prophetic: [day.ReadingsList.length] })).toThrow('Invalid reading selection')
  expect(() => selectedReadings(day, { gospel: [], epistle: [], prophetic: [-1] })).toThrow('Invalid reading selection')
})

it('previews replacement of only the explicitly selected prophetic field and supports deselection', async () => {
  const result = await getLectionaryDay(initial.date, 'en')
  if (!result.ok) throw Error(result.reason)
  const reference = result.day.ReadingsList[0]
  const onApply = jest.fn(() => true)
  await render(picker(initial, onApply))
  await fireEvent.press(screen.getByRole('button', { name: 'Preview readings for this date' }))
  const choice = await screen.findByRole('checkbox', { name: `Prophetic reading: ${reference}` })
  expect(choice).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Apply selected readings' })).toBeDisabled()
  await fireEvent.press(choice)
  expect(screen.getByText('Current: Manual prophetic')).toBeOnTheScreen()
  expect(onApply).not.toHaveBeenCalled()
  await fireEvent.press(choice)
  expect(screen.getByRole('button', { name: 'Apply selected readings' })).toBeDisabled()
  await fireEvent.press(choice)
  await fireEvent.press(screen.getByRole('button', { name: 'Apply selected readings' }))
  expect(onApply).toHaveBeenCalledWith(initial, { prophetic: reference })
  expect(initial.options.gospel).toBe('Manual Gospel')
})

it('blocks prophetic replacement when a manual edit makes the preview stale', async () => {
  const result = await getLectionaryDay(initial.date, 'en')
  if (!result.ok) throw Error(result.reason)
  const onApply = jest.fn(() => true)
  const view = await render(picker(initial, onApply))
  await fireEvent.press(screen.getByRole('button', { name: 'Preview readings for this date' }))
  await fireEvent.press(await screen.findByRole('checkbox', { name: `Prophetic reading: ${result.day.ReadingsList[0]}` }))
  await view.rerender(picker({ ...initial, options: { ...initial.options, prophetic: 'New manual edit' } }, onApply))
  expect(screen.getByRole('button', { name: 'Apply selected readings' })).toBeDisabled()
  expect(onApply).not.toHaveBeenCalled()
})

it('keeps empty offline days non-applicable without clearing manual prophetic text', async () => {
  const onApply = jest.fn(() => true)
  await render(picker({ ...initial, date: '2026-01-26' }, onApply))
  await fireEvent.press(screen.getByRole('button', { name: 'Preview readings for this date' }))
  expect(await screen.findByText('No readings are appointed for this date. Your existing reading fields will stay unchanged.')).toBeOnTheScreen()
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Apply selected readings' })).toBeDisabled()
  expect(onApply).not.toHaveBeenCalled()
})
