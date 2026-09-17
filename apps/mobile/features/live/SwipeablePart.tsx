import { useEffect, useRef, type PropsWithChildren } from 'react'
import { View } from 'react-native'
import { useRecyclingState } from '@shopify/flash-list'
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable'
import { useAnimatedReaction, useSharedValue, type SharedValue } from 'react-native-reanimated'
import { AppButton } from '../../components/AppButton'
import { useTheme } from '../../design/ThemeProvider'

const actionWidth = 72

type SwipeablePartProps = PropsWithChildren<{
  partLabel: string; testID: string; onSwipeStart(): void; onOpen(): void
}>

export function SwipeablePart({ children, partLabel, testID, onSwipeStart, onOpen }: SwipeablePartProps) {
  // Rows are memoized and recycled; the latest callbacks ride a ref so rerenders don't restamp them.
  const actions = useRef({ onSwipeStart, onOpen })
  useEffect(() => { actions.current = { onSwipeStart, onOpen } }, [onSwipeStart, onOpen])
  const swipeable = useRef<SwipeableMethods | null>(null)
  const maxProgress = useSharedValue(0)
  const width = useRef(0)
  // Reusing a recycled row for another part must start closed, not mid-swipe.
  const [revealed, setRevealed] = useRecyclingState(false, [testID], () => {
    swipeable.current?.reset()
    maxProgress.value = 0
  })
  const beginDrag = () => {
    // eslint-disable-next-line react-hooks/immutability -- writing .value is Reanimated's SharedValue update API
    maxProgress.value = 0
    actions.current.onSwipeStart()
  }
  return <View testID={testID} onLayout={event => { width.current = event.nativeEvent.layout.width }}>
    <ReanimatedSwipeable ref={swipeable} testID={testID}
      renderRightActions={progress => <PartActionsTray progress={progress} maxProgress={maxProgress}
        partLabel={partLabel} revealed={revealed} onPress={() => {
          swipeable.current?.reset()
          setRevealed(false, true)
          actions.current.onOpen()
        }} />}
      onSwipeableOpenStartDrag={beginDrag}
      onSwipeableCloseStartDrag={beginDrag}
      onSwipeableWillOpen={() => {
        // Progress is linear in drag distance with the default overshootFriction of 1; the
        // threshold in progress units is the old pixel threshold divided by the tray width.
        const fullSwipe = maxProgress.value >= Math.max(actionWidth * 2, width.current / 2) / actionWidth
        // eslint-disable-next-line react-hooks/immutability -- writing .value is Reanimated's SharedValue update API
        maxProgress.value = 0
        if (fullSwipe) {
          swipeable.current?.reset()
          setRevealed(false, true)
          actions.current.onOpen()
        } else {
          setRevealed(true, true)
        }
      }}
      onSwipeableWillClose={() => {
        // eslint-disable-next-line react-hooks/immutability -- writing .value is Reanimated's SharedValue update API
        maxProgress.value = 0
        setRevealed(false, true)
      }}>
      {children}
    </ReanimatedSwipeable>
  </View>
}

function PartActionsTray({ progress, maxProgress, partLabel, revealed, onPress }: {
  progress: SharedValue<number>; maxProgress: SharedValue<number>; partLabel: string; revealed: boolean; onPress(): void
}) {
  const { colors } = useTheme()
  // Track the highest progress reached during a drag so the full-swipe trigger can read it on the JS thread.
  useAnimatedReaction(() => progress.value, value => {
    // eslint-disable-next-line react-hooks/immutability -- worklet writes back to the parent's shared value
    if (value > maxProgress.value) maxProgress.value = value
  })
  return <View pointerEvents={revealed ? 'auto' : 'none'} accessibilityElementsHidden={!revealed}
    importantForAccessibility={revealed ? 'auto' : 'no-hide-descendants'}
    style={{ width: actionWidth, height: '100%', backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }}>
    <AppButton icon="details" iconOnly variant="quiet" accessibilityLabel={`View details for ${partLabel}`} onPress={onPress}>Details</AppButton>
  </View>
}
