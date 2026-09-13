import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { Animated, Easing, PanResponder, View } from 'react-native'
import { AppButton } from '../../components/AppButton'
import { useTheme } from '../../design/ThemeProvider'
import { spacing, touchTarget } from '../../design/tokens'

const actionWidth = 72

export function SwipeablePart({ children, partLabel, testID, reduceMotion, onSwipeStart, onOpen }: PropsWithChildren<{
  partLabel: string; testID: string; reduceMotion: boolean; onSwipeStart(): void; onOpen(): void
}>) {
  const { colors } = useTheme()
  const row = useRef<View>(null)
  const actions = useRef({ onSwipeStart, onOpen })
  useEffect(() => { actions.current = { onSwipeStart, onOpen } }, [onSwipeStart, onOpen])
  const [translation] = useState(() => new Animated.Value(0))
  const dimensions = useRef({ width: 0, height: 0 })
  const restingOffset = useRef(0)
  const dragOrigin = useRef(0)
  const touchStarted = useRef(0)
  const [revealed, setRevealed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [actionTop, setActionTop] = useState<number>(spacing.lg)

  const gesture = useMemo(() => {
    const settle = (show: boolean) => {
      const offset = show ? -actionWidth : 0
      restingOffset.current = offset
      setRevealed(show)
      setDragging(false)
      translation.stopAnimation()
      if (reduceMotion) translation.setValue(offset)
      else Animated.timing(translation, { toValue: offset, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
    }
    // PanResponder stores these callbacks; refs are read only when touch events fire.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: event => { touchStarted.current = event.nativeEvent.timestamp; return false },
      onMoveShouldSetPanResponderCapture: (event, movement) => {
        // Vertical reading scroll and press-and-hold text selection keep their
        // native responders. A right swipe only handles an already open row.
        return movement.numberActiveTouches === 1 && event.nativeEvent.timestamp - touchStarted.current < 350
          && Math.abs(movement.dx) > 12 && Math.abs(movement.dx) > Math.abs(movement.dy) * 1.5
          && (movement.dx < 0 || restingOffset.current < 0)
      },
      onPanResponderGrant: (_event, movement) => {
        translation.stopAnimation()
        dragOrigin.current = restingOffset.current
        setDragging(true)
        actions.current.onSwipeStart()
        // Parts can be taller than the screen. Keep the info target beside the
        // place the user swiped, rather than halfway down an offscreen prayer.
        row.current?.measureInWindow((_x, y, _width, height) => {
          setActionTop(Math.max(spacing.sm, Math.min(movement.y0 - y - touchTarget / 2, height - touchTarget - spacing.sm)))
        })
      },
      onPanResponderMove: (_event, movement) => {
        const limit = Math.max(actionWidth, dimensions.current.width - touchTarget)
        translation.setValue(Math.max(-limit, Math.min(0, dragOrigin.current + movement.dx)))
      },
      onPanResponderRelease: (_event, movement) => {
        const fullSwipe = Math.max(actionWidth * 2, dimensions.current.width * 0.5)
        if (-movement.dx >= fullSwipe && Math.abs(movement.dx) > Math.abs(movement.dy) * 1.5) {
          restingOffset.current = 0
          translation.setValue(0)
          setRevealed(false)
          setDragging(false)
          actions.current.onOpen()
        } else settle(dragOrigin.current + movement.dx < -actionWidth / 2)
      },
      onPanResponderTerminationRequest: () => true,
      onPanResponderTerminate: () => settle(false),
    })
  }, [translation, reduceMotion])

  return <View ref={row} testID={testID} onLayout={event => { dimensions.current = event.nativeEvent.layout }}
    style={{ overflow: 'hidden' }}>
    {(revealed || dragging) && <View pointerEvents={revealed ? 'auto' : 'none'} accessibilityElementsHidden={!revealed}
      importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
      style={{ position: 'absolute', inset: 0, backgroundColor: colors.secondary }}>
      <View style={{ position: 'absolute', right: 0, top: actionTop, width: actionWidth, alignItems: 'center' }}>
        <AppButton icon="info" iconOnly variant="quiet" accessibilityLabel={`View details for ${partLabel}`}
          onPress={() => {
            restingOffset.current = 0
            translation.stopAnimation()
            translation.setValue(0)
            setRevealed(false)
            actions.current.onOpen()
          }}>Details</AppButton>
      </View>
    </View>}
    <Animated.View testID={`${testID}-gesture`} {...gesture.panHandlers} style={{ transform: [{ translateX: translation }] }}>
      {children}
    </Animated.View>
  </View>
}
