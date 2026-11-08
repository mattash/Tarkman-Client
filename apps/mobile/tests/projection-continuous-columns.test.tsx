import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'
import { ProjectionText } from '../features/displayLinks/ProjectionText'
import { createContinuousGroup, createProjectionClock } from '../features/displayLinks/projectionTiming'
import { createManualPosition, createPageGroup } from '../features/displayLinks/customization'

// Keep the real ProjectionText effects and scheduler; stand in only for native scroll commands.
const mockScrolls: Array<{ column: number; at: number; y: number }> = []
let mockSerial = 0
jest.mock('react-native', () => {
  const native = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')
  const mockNative = Object.defineProperties({}, Object.getOwnPropertyDescriptors(native))
  Object.defineProperty(mockNative, 'ScrollView', { configurable: true, value: React.forwardRef((props: Record<string, unknown>, ref) => {
    const column = React.useRef<number | null>(null)
    if (column.current === null) column.current = mockSerial++
    React.useImperativeHandle(ref, () => ({ scrollTo: ({ y }: { y: number }) => {
      mockScrolls.push({ column: column.current!, at: performance.now(), y })
    } }))
    return React.createElement(native.View, props)
  }) })
  return mockNative
})
jest.mock('../features/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
jest.mock('../components/LiturgyText', () => ({ LiturgyText: () => null }))
jest.mock('../components/AppText', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native')
  return { AppText: (props: Record<string, unknown>) => React.createElement(Text, props) }
})

beforeEach(() => {
  jest.useFakeTimers({ now: 0 })
  mockSerial = 0; mockScrolls.length = 0
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
})
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })

async function pair(initialDuration = 60000, count = 2) {
  let clockOffset = 0
  const clock = createProjectionClock(() => performance.now() + clockOffset)
  const group = createContinuousGroup()
  function Columns({ duration = initialDuration, linked = count === 2 }: { duration?: number; linked?: boolean }) {
    return <>{Array.from({ length: count }, (_, column) => <ProjectionText key={column} text={`Column ${column}`} fontSize={40}
      clock={clock} durationMs={duration} continuousGroup={linked ? group : undefined} />)}</>
  }
  clock.setRunning(true)
  const view = await render(<Columns />)
  const columns = view.getAllByTestId('projection-text-scroll')
  const measure = async (column: number, content: number) => {
    await fireEvent(columns[column], 'layout', { nativeEvent: { layout: { height: 600, width: 600, x: 0, y: 0 } } })
    await fireEvent(columns[column], 'contentSizeChange', 600, content)
  }
  const advance = async (milliseconds: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(milliseconds) }) }
  const latest = (column: number) => mockScrolls.filter(scroll => scroll.column === column).at(-1)!
  const jumpClockWithoutCallbacks = (milliseconds: number) => { clockOffset += milliseconds }
  return { view, Columns, group, clock, measure, advance, latest, jumpClockWithoutCallbacks }
}

it('renders unequal continuous columns with shared endpoint, distinct speeds and shared closing dwell', async () => {
  const h = await pair()
  await h.measure(0, 1000); await h.measure(1, 2000)
  await h.advance(8000)
  expect(h.latest(0).y).toBe(0); expect(h.latest(1).y).toBe(0)
  await h.advance(22000)
  expect(h.latest(0).y).toBeCloseTo(200, 0)
  expect(h.latest(1).y).toBeCloseTo(700, 0)
  await h.advance(22000)
  const endpoints = [400, 1400].map((maximum, column) => mockScrolls.find(scroll => scroll.column === column && scroll.y === maximum)!)
  expect(endpoints.every(Boolean)).toBe(true)
  expect(Math.abs(endpoints[0].at - endpoints[1].at)).toBeLessThanOrEqual(16)
  expect(endpoints[0].at).toBeGreaterThanOrEqual(51000)
  expect(endpoints[0].at).toBeLessThan(51017)
  const count = mockScrolls.length
  await h.advance(8000)
  expect(mockScrolls).toHaveLength(count)
})

it('accepts API duration corrections for a single independent language without a continuous group', async () => {
  const h = await pair(30000, 1)
  const position = jest.spyOn(h.group, 'position')
  await h.measure(0, 2000)
  await h.advance(15000)
  expect(h.latest(0).y).toBeCloseTo(700, 0)
  await h.view.rerender(<h.Columns duration={90000} />)
  expect(h.latest(0).y).toBeCloseTo(2000 / 6 - 300, 0)
  expect(position).not.toHaveBeenCalled()
  await h.advance(30000)
  expect(h.latest(0).y).toBeCloseTo(700, 0)
})

it('preserves both fractions on a 30s to 90s correction and retimes their remaining travel together', async () => {
  const h = await pair(30000)
  await h.measure(0, 1000); await h.measure(1, 2000)
  await h.advance(15000)
  const before = [h.latest(0).y, h.latest(1).y]
  await h.view.rerender(<h.Columns duration={90000} />)
  await h.advance(16)
  // Allow one frame of forward travel, but not a correction-induced jump.
  expect(Math.abs(h.latest(0).y - before[0])).toBeLessThan(1)
  expect(Math.abs(h.latest(1).y - before[1])).toBeLessThan(1)
  await h.advance(30734)
  expect(h.latest(0).y / 400).toBeCloseTo(0.75, 3)
  expect(h.latest(1).y / 1400).toBeCloseTo(0.75, 3)
  await h.advance(31000)
  const endpoints = [400, 1400].map((maximum, column) => mockScrolls.find(scroll => scroll.column === column && scroll.y === maximum)!)
  expect(endpoints.every(Boolean)).toBe(true)
  expect(endpoints[0].at).toBeGreaterThanOrEqual(76500)
  expect(endpoints[0].at).toBeLessThan(76517)
  expect(Math.abs(endpoints[0].at - endpoints[1].at)).toBeLessThanOrEqual(16)
})

it('does not replay a finished partner on reflow or refreshed duration', async () => {
  const h = await pair()
  await h.measure(0, 1000); await h.measure(1, 2000)
  await h.advance(52000)
  expect(h.latest(0).y).toBe(400)
  mockScrolls.length = 0
  await h.measure(1, 6000)
  await h.view.rerender(<h.Columns duration={120000} />)
  await h.advance(16)
  expect(mockScrolls.filter(scroll => scroll.column === 0).every(scroll => scroll.y === 400)).toBe(true)
  expect(h.latest(1).y).toBe(5400)
  await h.advance(1000)
  expect(h.latest(1).y).toBe(5400)
})

it('does not jump from a stale old opening hold when resize precedes the next scheduled callback', async () => {
  const h = await pair()
  await h.measure(0, 1000); await h.measure(1, 3000)
  h.jumpClockWithoutCallbacks(7000)
  await h.measure(1, 2000)
  await h.advance(16)
  expect(h.latest(0).y).toBe(0); expect(h.latest(1).y).toBe(0)
  h.jumpClockWithoutCallbacks(3000)
  await h.measure(1, 1500)
  await h.advance(16)
  expect(h.latest(0).y).toBe(0); expect(h.latest(1).y).toBe(0)
  await h.advance(3000)
  expect(h.latest(0).y).toBeGreaterThan(0)
  expect(h.latest(0).y / 400).toBeCloseTo(h.latest(1).y / 900, 3)
})

it('falls back after 250ms when the other mounted column never measures', async () => {
  const h = await pair()
  await h.advance(30000)
  await h.measure(0, 1000)
  await h.advance(249)
  expect(mockScrolls.filter(scroll => scroll.column === 0 && scroll.y > 0)).toEqual([])
  await h.advance(1)
  expect(h.latest(0).y).toBeGreaterThan(0)
  expect(h.latest(0).y).toBeLessThan(400)
})

it('uses the dense second measurement arriving inside the 250ms wait', async () => {
  const h = await pair()
  await h.advance(30000)
  await h.measure(0, 1000)
  await h.advance(100)
  expect(mockScrolls.filter(scroll => scroll.column === 0 && scroll.y > 0)).toEqual([])
  await h.measure(1, 2000)
  await h.advance(16)
  const fraction = (30116 - 9000) / 42000
  expect(h.latest(0).y / 400).toBeCloseTo(fraction, 3)
  expect(h.latest(1).y / 1400).toBeCloseTo(fraction, 3)
})

it('keeps a stable group phase on rerender/reflow and removes membership only on unmount', async () => {
  const h = await pair()
  const remove = jest.spyOn(h.group, 'remove')
  await h.measure(0, 1000); await h.measure(1, 2000)
  await h.advance(30000)
  await h.view.rerender(<h.Columns />)
  await h.measure(1, 6000)
  await h.advance(16)
  expect(h.latest(0).y / 400).toBeCloseTo(0.5, 3)
  expect(h.latest(1).y / 5400).toBeCloseTo(0.5, 3)
  await h.advance(1000)
  expect(h.latest(0).y / 400).toBeCloseTo(h.latest(1).y / 5400, 3)
  expect(remove).not.toHaveBeenCalled()
  await h.view.unmount()
  expect(remove).toHaveBeenCalledTimes(2)
})

it('honors the new independent duration when switching away from a linked group', async () => {
  const h = await pair(30000)
  await h.measure(0, 1000); await h.measure(1, 2000)
  await h.advance(15000)
  await h.view.rerender(<h.Columns duration={90000} linked={false} />)
  expect(h.latest(0).y).toBe(0)
  expect(h.latest(1).y).toBeCloseTo(2000 / 6 - 300, 0)
  await h.advance(30000)
  expect(h.latest(0).y).toBeCloseTo(200, 0)
  expect(h.latest(1).y).toBeCloseTo(700, 0)
})

it('normalizes missing-text placeholder geometry for manual maximum, linked pages and preview overflow', async () => {
  const clock = createProjectionClock(() => performance.now())
  const manualPosition = createManualPosition(), pageGroup = createPageGroup()
  manualPosition.set(0.5)
  const props = { text: null, fontSize: 40, clock, durationMs: 60000, manualPosition, pageGroup, preview: true } as const
  const view = await render(<ProjectionText {...props} movement="manual" />)
  const column = view.getByTestId('projection-text-scroll')
  await fireEvent(column, 'layout', { nativeEvent: { layout: { height: 600, width: 600, x: 0, y: 0 } } })
  await fireEvent(column, 'contentSizeChange', 600, 2000)
  expect(mockScrolls.at(-1)?.y).toBe(0)
  expect(pageGroup.get()).toBe(1)
  await fireEvent(column, 'scroll', { nativeEvent: { contentOffset: { y: 200 } } })
  expect(manualPosition.get()).toBe(0.5)
  await view.rerender(<ProjectionText {...props} movement="none" />)
  expect(view.getByText('display.projectionNoText')).toBeTruthy()
  expect(view.queryByText('display.previewOverflow')).toBeNull()
})
