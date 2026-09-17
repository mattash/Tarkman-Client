import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native'
import { Text } from 'react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { SwipeablePart } from '../features/live/SwipeablePart'
import { clearSwipeableMocks, findSwipeable } from './swipeable-helpers'

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- the hoisted factory can't reference an imported binding
  default: require('./swipeable-helpers').MockSwipeable,
}))

// The tray sits beside a 402pt row, so a full swipe has to clear half the row: 201pt over the
// 72pt tray is 2.8 progress. A reveal stops short of that; the pixel width comes from onLayout.
const rowWidth = 402
const reveal = 1.1
const fullSwipe = 3.2

beforeEach(() => {
  jest.clearAllMocks()
  clearSwipeableMocks()
})
afterEach(() => { jest.restoreAllMocks() })

const row = (testID: string, onSwipeStart: () => void, onOpen: () => void) =>
  <ThemeProvider scheme="light">
    <SwipeablePart testID={testID} partLabel="deacon" onSwipeStart={onSwipeStart} onOpen={onOpen}>
      <Text>Alleluia</Text>
    </SwipeablePart>
  </ThemeProvider>

// Every fireEvent has to be awaited: an unawaited one leaves its act scope open, and React then
// drops the updates of every later render in the file.
const measure = async (view: RenderResult, testID: string) =>
  await fireEvent(view.getByTestId(testID), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: rowWidth, height: 80 } } })

// A tray out of reach is hidden from accessibility, so label queries skip it exactly as a screen reader would.
const trayReachable = (view: RenderResult) => view.queryByLabelText('View details for deacon') !== null

it('leaves the tray unreachable until a swipe settles it open', async () => {
  const view = await render(row('row-hidden', jest.fn(), jest.fn()))
  expect(trayReachable(view)).toBe(false)
  const instance = findSwipeable('row-hidden')
  await act(async () => { (instance.props['onSwipeableOpenStartDrag'] as () => void)() })
  instance.progress.value = reveal
  await act(async () => { (instance.props['onSwipeableWillOpen'] as () => void)() })
  expect(trayReachable(view)).toBe(true)
})

it('reports the drag start once the gesture is recognised, before it settles', async () => {
  const onSwipeStart = jest.fn()
  await render(row('row-start', onSwipeStart, jest.fn()))
  const instance = findSwipeable('row-start')
  await act(async () => { (instance.props['onSwipeableOpenStartDrag'] as () => void)() })
  expect(onSwipeStart).toHaveBeenCalledTimes(1)
})

it('opens the part from the revealed tray button', async () => {
  const onOpen = jest.fn()
  const view = await render(row('row-press', jest.fn(), onOpen))
  const instance = findSwipeable('row-press')
  await act(async () => { (instance.props['onSwipeableOpenStartDrag'] as () => void)() })
  instance.progress.value = reveal
  await act(async () => { (instance.props['onSwipeableWillOpen'] as () => void)() })
  await fireEvent.press(view.getByLabelText('View details for deacon'))
  expect(onOpen).toHaveBeenCalledTimes(1)
  // Opening a part closes the row behind it, so returning to the list shows no stranded tray.
  expect(instance.methods.reset).toHaveBeenCalledTimes(1)
  expect(trayReachable(view)).toBe(false)
})

it('opens the part without the tray when a drag crosses half the row', async () => {
  const onOpen = jest.fn()
  const view = await render(row('row-full', jest.fn(), onOpen))
  await measure(view, 'row-full')
  const instance = findSwipeable('row-full')
  await act(async () => { (instance.props['onSwipeableOpenStartDrag'] as () => void)() })
  instance.progress.value = fullSwipe
  await act(async () => { (instance.props['onSwipeableWillOpen'] as () => void)() })
  expect(onOpen).toHaveBeenCalledTimes(1)
  expect(instance.methods.reset).toHaveBeenCalledTimes(1)
  expect(trayReachable(view)).toBe(false)
})

it('reveals the tray, and opens nothing, when a drag stops short of half the row', async () => {
  const onOpen = jest.fn()
  const view = await render(row('row-short', jest.fn(), onOpen))
  await measure(view, 'row-short')
  const instance = findSwipeable('row-short')
  await act(async () => { (instance.props['onSwipeableOpenStartDrag'] as () => void)() })
  // 2.2 progress is 158pt: past the tray, short of the 201pt half-row trigger.
  instance.progress.value = 2.2
  await act(async () => { (instance.props['onSwipeableWillOpen'] as () => void)() })
  expect(onOpen).not.toHaveBeenCalled()
  expect(instance.methods.reset).not.toHaveBeenCalled()
  expect(trayReachable(view)).toBe(true)
})

it('takes the tray back out of reach when the row swipes closed', async () => {
  const view = await render(row('row-close', jest.fn(), jest.fn()))
  const instance = findSwipeable('row-close')
  await act(async () => { (instance.props['onSwipeableOpenStartDrag'] as () => void)() })
  instance.progress.value = reveal
  await act(async () => { (instance.props['onSwipeableWillOpen'] as () => void)() })
  await act(async () => { (instance.props['onSwipeableWillClose'] as () => void)() })
  expect(trayReachable(view)).toBe(false)
})

it('measures each drag on its own, so a closed row does not inherit the last peak', async () => {
  const onOpen = jest.fn()
  const view = await render(row('row-peak', jest.fn(), onOpen))
  await measure(view, 'row-peak')
  const instance = findSwipeable('row-peak')
  await act(async () => { (instance.props['onSwipeableOpenStartDrag'] as () => void)() })
  instance.progress.value = fullSwipe
  await act(async () => { (instance.props['onSwipeableWillOpen'] as () => void)() })
  expect(onOpen).toHaveBeenCalledTimes(1)
  // A later short drag must not reopen the part off the previous drag's peak.
  await act(async () => { (instance.props['onSwipeableOpenStartDrag'] as () => void)() })
  instance.progress.value = reveal
  await act(async () => { (instance.props['onSwipeableWillOpen'] as () => void)() })
  expect(onOpen).toHaveBeenCalledTimes(1)
})

it('opens the part the recycled row now shows, closing the row it inherited', async () => {
  const first = jest.fn()
  const second = jest.fn()
  const view = await render(row('row-first', jest.fn(), first))
  await view.rerender(row('row-second', jest.fn(), second))
  const instance = findSwipeable('row-second')
  // Recycling resets the swipeable so the new part never appears mid-swipe.
  expect(instance.methods.reset).toHaveBeenCalled()
  await measure(view, 'row-second')
  await act(async () => { (instance.props['onSwipeableOpenStartDrag'] as () => void)() })
  instance.progress.value = fullSwipe
  await act(async () => { (instance.props['onSwipeableWillOpen'] as () => void)() })
  expect(second).toHaveBeenCalledTimes(1)
  expect(first).not.toHaveBeenCalled()
})
