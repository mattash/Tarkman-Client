import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { useEffect } from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'
import { ProjectionText } from '../features/displayLinks/ProjectionText'
import { createContinuousGroup, createProjectionClock } from '../features/displayLinks/projectionTiming'

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
jest.mock('../components/AppText', () => ({ AppText: () => null }))

beforeEach(() => {
  jest.useFakeTimers({ now: 0 })
  mockSerial = 0; mockScrolls.length = 0
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
})
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })

async function pair() {
  const clock = createProjectionClock(() => performance.now())
  const group = createContinuousGroup()
  // Match DisplayPresentation: parent declares expected membership in an effect.
  function Columns({ duration = 60000 }: { duration?: number }) {
    useEffect(() => group.expect(2), [])
    return <>{[0, 1].map(column => <ProjectionText key={column} text={`Column ${column}`} fontSize={40}
      clock={clock} durationMs={duration} continuousGroup={group} />)}</>
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
  return { view, Columns, group, clock, measure, advance, latest }
}

it('renders unequal continuous columns with shared endpoint, distinct speeds and shared closing dwell', async () => {
  const h = await pair()
  await h.measure(0, 1000)
  await h.measure(1, 2000)
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

it('does not replay a finished partner on reflow or refreshed duration', async () => {
  const h = await pair()
  await h.measure(0, 1000); await h.measure(1, 2000)
  await h.advance(52000)
  expect(h.latest(0).y).toBe(400)
  mockScrolls.length = 0
  await h.measure(1, 6000)
  await h.view.rerender(<h.Columns duration={120000} />)
  expect(mockScrolls.filter(scroll => scroll.column === 0).every(scroll => scroll.y === 400)).toBe(true)
  expect(h.latest(1).y).toBe(5400)
  await h.advance(1000)
  expect(h.latest(1).y).toBe(5400)
})

it('waits for both measurements when layout arrives after reading has begun', async () => {
  const h = await pair()
  await h.advance(30000)
  await h.measure(0, 1000)
  expect(mockScrolls.filter(scroll => scroll.column === 0 && scroll.y > 0)).toEqual([])
  await h.measure(1, 2000)
  expect(h.group.get()).toBe(0.15)
  expect(h.latest(0).y).toBeCloseTo(200, 0)
  expect(h.latest(1).y).toBeCloseTo(700, 0)
})
