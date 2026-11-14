import { afterEach, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { TextProps } from 'react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { ReadingFontContext } from '../design/readingFont'
import { LiturgyText, type PassageHighlight, type VisibleTextLayout } from '../components/LiturgyText'

let mockDimensions = { width: 390, height: 844, scale: 3, fontScale: 1 }
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDimensions }))

// Model native VirtualText: its ref exists but cannot supply useful glyph bounds.
const mockAnchor = { measureInWindow: jest.fn((done: (x: number, y: number, width: number, height: number) => void) => done(0, 0, 0, 0)) }
let mockNativeWidth = 320
const mockFrame = { measureInWindow: jest.fn((done: (x: number, y: number, width: number, height: number) => void) => done(0, 100, mockNativeWidth, 9000)) }
jest.mock('react-native/Libraries/Text/Text', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return { __esModule: true, default: React.forwardRef<unknown, TextProps>((props, ref) => {
    React.useImperativeHandle(ref, () => props.testID === 'body' ? mockFrame : mockAnchor)
    return React.createElement('Text', props)
  }) }
})

const prefix = 'Lord have mercy and grant us peace. '.repeat(200)
const text = `${prefix}Exact passage lantern is here.`
const start = text.indexOf('lantern')
const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light">{children}</ThemeProvider>
const request = (requestId: number, onMeasure: PassageHighlight['onMeasure']) => ({ start, end: start + 7, requestId, onMeasure })
const layout = (width = 320) => {
  mockNativeWidth = width
  return fireEvent(screen.getByTestId('body'), 'layout', { nativeEvent: { layout: { width, height: 9000, x: 0, y: 0 } } })
}
const textLayout = (y = 8200) => fireEvent(screen.getByTestId('body'), 'textLayout', { nativeEvent: { lines: [
  { text: prefix, y: 0, height: 40 },
  { text: 'Exact passage lantern is here.', y, height: 40 },
] } })
async function tick() { await act(() => { jest.advanceTimersByTime(100) }) }
afterEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
  mockDimensions = { width: 390, height: 844, scale: 3, fontScale: 1 }
  mockNativeWidth = 320
  mockFrame.measureInWindow.mockImplementation(done => done(0, 100, mockNativeWidth, 9000))
})

it('reuses native line geometry for the same range with a new request, without another text-layout event', async () => {
  jest.useFakeTimers()
  const first = jest.fn<NonNullable<PassageHighlight['onMeasure']>>()
  const repeated = jest.fn<NonNullable<PassageHighlight['onMeasure']>>()
  const view = await render(<LiturgyText testID="body" text={text} passageHighlight={request(1, first)} />, { wrapper })
  await layout()
  await textLayout()
  await tick()
  expect(first).toHaveBeenLastCalledWith(8300, 40, expect.objectContaining(mockAnchor))
  await view.rerender(<LiturgyText testID="body" text={text} passageHighlight={request(2, repeated)} />)
  await tick()
  expect(repeated).toHaveBeenLastCalledWith(8300, 40, expect.objectContaining(mockAnchor))
})

it('keeps visible-line capture and repeated bookmark jumps on the same native geometry without a fresh layout', async () => {
  jest.useFakeTimers()
  const measured = jest.fn<NonNullable<PassageHighlight['onMeasure']>>()
  let visible: VisibleTextLayout | undefined
  const register = (value: VisibleTextLayout) => { visible = value; return () => {} }
  const view = await render(<LiturgyText testID="body" text={text} registerVisibleText={register} />, { wrapper })
  await layout()
  await textLayout()
  expect(visible?.range(8200, 8400)).toEqual({ start: prefix.length, end: text.length })
  // Bookmark/open adds a highlight to text that was already measured for resume capture.
  await view.rerender(<LiturgyText testID="body" text={text} registerVisibleText={register} passageHighlight={request(1, measured)} />)
  await tick()
  expect(measured).toHaveBeenLastCalledWith(8300, 40, expect.objectContaining(mockAnchor))
  measured.mockClear()
  await view.rerender(<LiturgyText testID="body" text={text} registerVisibleText={register} passageHighlight={request(2, measured)} />)
  await tick()
  expect(measured).toHaveBeenLastCalledWith(8300, 40, expect.objectContaining(mockAnchor))
  expect(visible?.range(8200, 8400)).toEqual({ start: prefix.length, end: text.length })
  measured.mockClear()
  await view.rerender(<LiturgyText testID="body" text={text} readingSize="larger" registerVisibleText={register} passageHighlight={request(3, measured)} />)
  await tick()
  expect(measured).not.toHaveBeenCalled()
  expect(visible?.range(8200, 8400)).toBeUndefined()
  await textLayout(6400)
  await tick()
  expect(measured).toHaveBeenLastCalledWith(6500, 40, expect.objectContaining(mockAnchor))
  expect(visible?.range(6400, 6600)).toEqual({ start: prefix.length, end: text.length })
})

it('rejects an old row payload delivered through the current text-layout handler and recovers on fresh lines', async () => {
  jest.useFakeTimers()
  const measured = jest.fn<NonNullable<PassageHighlight['onMeasure']>>()
  const view = await render(<LiturgyText testID="body" text={text} passageHighlight={request(1, measured)} />, { wrapper })
  await layout()
  await textLayout()
  await tick()
  measured.mockClear()
  const suffix = 'Different passage lantern is here.'
  const currentText = prefix + suffix
  const currentStart = currentText.indexOf('lantern')
  await view.rerender(<LiturgyText testID="body" text={currentText}
    passageHighlight={{ start: currentStart, end: currentStart + 7, requestId: 2, onMeasure: measured }} />)
  // Native can queue the old row's payload but invoke the newly rendered callback.
  // The shared prefix maps; the stale suffix does not. Reject the whole payload.
  await textLayout()
  await tick()
  expect(measured).not.toHaveBeenCalled()
  await fireEvent(screen.getByTestId('body'), 'textLayout', { nativeEvent: { lines: [
    { text: prefix, y: 0, height: 40 }, { text: suffix, y: 6400, height: 40 },
  ] } })
  await tick()
  expect(measured).toHaveBeenLastCalledWith(6500, 40, expect.objectContaining(mockAnchor))
})

it('uses cached lines for a different range in the same unchanged paragraph', async () => {
  jest.useFakeTimers()
  const measured = jest.fn<NonNullable<PassageHighlight['onMeasure']>>()
  const view = await render(<LiturgyText testID="body" text={text} passageHighlight={request(1, measured)} />, { wrapper })
  await layout()
  await textLayout()
  await tick()
  measured.mockClear()
  await view.rerender(<LiturgyText testID="body" text={text} passageHighlight={{ start: 0, end: 4, requestId: 2, onMeasure: measured }} />)
  await tick()
  expect(measured).toHaveBeenLastCalledWith(100, 40, expect.objectContaining(mockAnchor))
})

it.each(['text', 'language', 'readingSize', 'style', 'font', 'fontScale', 'windowWidth'] as const)('does not reuse stale native lines after a %s change', async changed => {
  jest.useFakeTimers()
  const measured = jest.fn<NonNullable<PassageHighlight['onMeasure']>>()
  const make = (next: boolean) => <ReadingFontContext.Provider value={!(next && changed === 'font')}>
    <LiturgyText testID="body" text={next && changed === 'text' ? `${text}!` : text}
      language={next && changed === 'language' ? 'ru' : 'en'} readingSize={next && changed === 'readingSize' ? 'larger' : 'standard'}
      style={next && changed === 'style' ? { lineHeight: 60 } : undefined} passageHighlight={request(next ? 2 : 1, measured)} />
  </ReadingFontContext.Provider>
  const view = await render(make(false), { wrapper })
  await layout()
  await textLayout()
  await tick()
  expect(measured).toHaveBeenCalled()
  measured.mockClear()
  if (changed === 'fontScale') mockDimensions = { ...mockDimensions, fontScale: 1.5 }
  if (changed === 'windowWidth') mockDimensions = { ...mockDimensions, width: 280 }
  await view.rerender(make(true))
  await tick()
  expect(measured).not.toHaveBeenCalled()
})

it('invalidates cached lines on a real text-width change until new text layout arrives', async () => {
  jest.useFakeTimers()
  const measured = jest.fn<NonNullable<PassageHighlight['onMeasure']>>()
  const view = await render(<LiturgyText testID="body" text={text} passageHighlight={request(1, measured)} />, { wrapper })
  await layout()
  await textLayout()
  await tick()
  measured.mockClear()
  await view.rerender(<LiturgyText testID="body" text={text} passageHighlight={request(2, measured)} />)
  await layout(240)
  await tick()
  expect(measured).not.toHaveBeenCalled()
  await textLayout()
  await tick()
  expect(measured).toHaveBeenLastCalledWith(8300, 40, expect.objectContaining(mockAnchor))
})

it.each([
  ['layout-first', false], ['text-layout-first', false],
  ['layout-first', true], ['text-layout-first', true],
] as const)('keeps fresh width-qualified lines with %s events and changed context=%s', async (order, changedContext) => {
  jest.useFakeTimers()
  const measured = jest.fn<NonNullable<PassageHighlight['onMeasure']>>()
  const view = await render(<LiturgyText testID="body" text={text} passageHighlight={request(1, measured)} />, { wrapper })
  await layout()
  await textLayout()
  await tick()
  measured.mockClear()
  if (changedContext) mockDimensions = { ...mockDimensions, width: 280 }
  await view.rerender(<LiturgyText testID="body" text={text} passageHighlight={request(2, measured)} />)
  mockNativeWidth = 240
  if (order === 'layout-first') {
    await layout(240)
    await textLayout(6400)
  } else {
    await textLayout(6400)
    await layout(240)
  }
  await tick()
  expect(measured).toHaveBeenLastCalledWith(6500, 40, expect.objectContaining(mockAnchor))
  // Another request needs no third text-layout event after either event ordering.
  measured.mockClear()
  await view.rerender(<LiturgyText testID="body" text={text} passageHighlight={request(3, measured)} />)
  await tick()
  expect(measured).toHaveBeenLastCalledWith(6500, 40, expect.objectContaining(mockAnchor))
})

it('keeps fresh lines when their async width measurement completes after onLayout', async () => {
  jest.useFakeTimers()
  const measured = jest.fn<NonNullable<PassageHighlight['onMeasure']>>()
  const view = await render(<LiturgyText testID="body" text={text} passageHighlight={request(1, measured)} />, { wrapper })
  await layout()
  await textLayout()
  await tick()
  measured.mockClear()
  mockDimensions = { ...mockDimensions, width: 280 }
  await view.rerender(<LiturgyText testID="body" text={text} passageHighlight={request(2, measured)} />)
  mockNativeWidth = 240
  const pending: ((x: number, y: number, width: number, height: number) => void)[] = []
  mockFrame.measureInWindow.mockImplementationOnce(done => { pending.push(done) })
  await textLayout(6400)
  await layout(240)
  await tick()
  expect(measured).not.toHaveBeenCalled()
  pending.forEach(done => done(0, 100, 240, 9000))
  await tick()
  expect(measured).toHaveBeenLastCalledWith(6500, 40, expect.objectContaining(mockAnchor))
})

it('rejects old-width geometry when native reflow happens before its onLayout event', async () => {
  jest.useFakeTimers()
  const measured = jest.fn<NonNullable<PassageHighlight['onMeasure']>>()
  const view = await render(<LiturgyText testID="body" text={text} passageHighlight={request(1, measured)} />, { wrapper })
  await layout()
  await textLayout()
  await tick()
  measured.mockClear()
  await view.rerender(<LiturgyText testID="body" text={text} passageHighlight={request(2, measured)} />)
  mockNativeWidth = 240
  await tick()
  expect(measured).not.toHaveBeenCalled()
})

it('ignores in-flight native frame measurement after recycling to new content', async () => {
  jest.useFakeTimers()
  const measured = jest.fn<NonNullable<PassageHighlight['onMeasure']>>()
  const pending: ((x: number, y: number, width: number, height: number) => void)[] = []
  const view = await render(<LiturgyText testID="body" text={text} passageHighlight={request(1, measured)} />, { wrapper })
  await layout()
  await textLayout()
  mockFrame.measureInWindow.mockImplementation(done => { pending.push(done) })
  await tick()
  expect(pending.length).toBeGreaterThan(0)
  await view.rerender(<LiturgyText testID="body" text="Recycled content" />)
  pending.forEach(done => done(0, 100, 320, 9000))
  expect(measured).not.toHaveBeenCalled()
  mockFrame.measureInWindow.mockImplementation(done => done(0, 100, 320, 9000))
})
