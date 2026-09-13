import { afterEach, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { PanResponder, type GestureResponderEvent, type PanResponderGestureState } from 'react-native'
import { AppText } from '../components/AppText'
import { ThemeProvider } from '../design/ThemeProvider'
import { SwipeablePart } from '../features/live/SwipeablePart'

const event = { nativeEvent: { timestamp: 1000 } } as GestureResponderEvent
const movement = (dx: number, dy = 0, touches = 1): PanResponderGestureState => ({
  dx, dy, numberActiveTouches: touches, stateID: 1, moveX: 200 + dx, moveY: 100 + dy,
  x0: 200, y0: 100, vx: 0, vy: 0, _accountsForMovesUpTo: 0,
})
afterEach(() => { jest.restoreAllMocks() })
async function setup() {
  const create = jest.spyOn(PanResponder, 'create')
  const open = jest.fn(), manual = jest.fn()
  await render(<ThemeProvider scheme="light"><SwipeablePart testID="part" partLabel="46 deacon" reduceMotion onOpen={open} onSwipeStart={manual}>
    <AppText selectable>Prayer remains selectable</AppText>
  </SwipeablePart></ThemeProvider>)
  await fireEvent(screen.getByTestId('part'), 'layout', { nativeEvent: { layout: { width: 402, height: 900, x: 0, y: 0 } } })
  const handlers = () => create.mock.calls.at(-1)![0]
  async function swipe(dx: number, terminate = false) {
    const handler = handlers()
    handler.onStartShouldSetPanResponderCapture?.(event, movement(0))
    expect(handler.onMoveShouldSetPanResponderCapture?.(event, movement(dx))).toBe(true)
    await act(async () => {
      handler.onPanResponderGrant?.(event, movement(0))
      handler.onPanResponderMove?.(event, movement(dx))
      if (terminate) handler.onPanResponderTerminate?.(event, movement(dx))
      else handler.onPanResponderRelease?.(event, movement(dx))
    })
  }
  return { open, manual, handlers, swipe }
}
it('reveals an info action on a short swipe, then opens the chosen part on tap', async () => {
  const { open, manual, swipe } = await setup()
  expect(screen.queryByRole('button', { name: 'View details for 46 deacon' })).toBeNull()
  await swipe(-80)
  expect(manual).toHaveBeenCalledTimes(1)
  expect(open).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'View details for 46 deacon' }))
  expect(open).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'View details for 46 deacon' })).toBeNull()
})
it('opens directly on a full left swipe and resets the row for returning from details', async () => {
  const { open, swipe } = await setup()
  await swipe(-220)
  expect(open).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'View details for 46 deacon' })).toBeNull()
})
it('closes on a right swipe and never opens after an interrupted gesture', async () => {
  const { open, swipe } = await setup()
  await swipe(-80)
  await swipe(70)
  expect(screen.queryByRole('button', { name: 'View details for 46 deacon' })).toBeNull()
  await swipe(-250, true)
  expect(open).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'View details for 46 deacon' })).toBeNull()
})
it('leaves vertical scrolling, multi-touch, small movements and long-press selection alone', async () => {
  const { handlers, open } = await setup()
  const handler = handlers()
  expect(handler.onStartShouldSetPanResponderCapture?.(event, movement(0))).toBe(false)
  for (const change of [movement(-5), movement(-30, 80), movement(60), movement(-60, 0, 2)]) {
    expect(handler.onMoveShouldSetPanResponderCapture?.(event, change)).toBe(false)
  }
  const heldEvent = { nativeEvent: { timestamp: 1600 } } as GestureResponderEvent
  expect(handler.onMoveShouldSetPanResponderCapture?.(heldEvent, movement(-70))).toBe(false)
  expect(open).not.toHaveBeenCalled()
  expect(screen.getByText('Prayer remains selectable')).toHaveProp('selectable', true)
})


it('keeps an in-progress gesture when the reader rerenders and uses the latest navigation callback', async () => {
  const create = jest.spyOn(PanResponder, 'create')
  const oldOpen = jest.fn(), nextOpen = jest.fn()
  const component = (onOpen: () => void) => <ThemeProvider scheme="light"><SwipeablePart testID="part" partLabel="46 deacon"
    reduceMotion onOpen={onOpen} onSwipeStart={() => {}}><AppText>Prayer</AppText></SwipeablePart></ThemeProvider>
  const view = await render(component(oldOpen))
  const handler = create.mock.calls.at(-1)![0]
  handler.onStartShouldSetPanResponderCapture?.(event, movement(0))
  await act(async () => { handler.onPanResponderGrant?.(event, movement(0)) })
  await view.rerender(component(nextOpen))
  expect(create.mock.calls.at(-1)![0]).toBe(handler)
  await act(async () => { handler.onPanResponderRelease?.(event, movement(-220)) })
  expect(oldOpen).not.toHaveBeenCalled()
  expect(nextOpen).toHaveBeenCalledTimes(1)
})
