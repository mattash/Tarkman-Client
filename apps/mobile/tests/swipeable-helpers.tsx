import { jest } from '@jest/globals'

export interface MockedInstance {
  props: Record<string, unknown>
  progress: { value: number }
  methods: { close: jest.Mock; openLeft: jest.Mock; openRight: jest.Mock; reset: jest.Mock }
}

// Mock-prefixed module-scope bindings are the only identifiers a jest.mock factory can reference.
export const mockInstances: MockedInstance[] = []

// Rows register on mount and drop on unmount, so this only ever holds live swipeables. A recycled
// row keeps its swipeable and takes a new testID, which is why the match reads the current props.
export const findSwipeable = (testID: string): MockedInstance => {
  const instance = mockInstances.find(candidate => candidate.props['testID'] === testID)
  if (instance) return instance
  throw new Error(`No mounted ReanimatedSwipeable has testID "${testID}". Mounted: ${mockInstances.map(i => String(i.props['testID'])).join(', ')}`)
}

export const clearSwipeableMocks = () => { mockInstances.length = 0 }

// Stands in for ReanimatedSwipeable: records the props the row passes, hands out the imperative
// methods as spies, and renders the row's children next to its right-actions tray so a test can
// drive the gesture callbacks the real component would fire. Registration happens in an effect,
// so it mirrors mount and unmount instead of leaking an entry per render.
export function MockSwipeable(props: Record<string, unknown>) {
  const Reanimated = jest.requireMock('react-native-reanimated') as { useSharedValue<T>(initial: T): { value: T } }
  const React = jest.requireActual('react') as typeof import('react')
  const RN = jest.requireActual('react-native') as typeof import('react-native')
  const progress = Reanimated.useSharedValue(0)
  const [instance] = React.useState<MockedInstance>(() => ({
    props,
    progress,
    methods: { close: jest.fn(), openLeft: jest.fn(), openRight: jest.fn(), reset: jest.fn() },
  }))
  // Recording the latest props is the point of this double; an effect keeps it out of render.
  // eslint-disable-next-line react-hooks/immutability -- the recorded instance is test state, not React state
  React.useEffect(() => { instance.props = props })
  React.useEffect(() => {
    mockInstances.push(instance)
    return () => {
      const at = mockInstances.indexOf(instance)
      if (at >= 0) mockInstances.splice(at, 1)
    }
  }, [instance])
  React.useImperativeHandle(props['ref'] as never, () => instance.methods)
  const renderActions = props['renderRightActions'] as
    ((p: typeof progress, t: typeof progress, m: typeof instance.methods) => React.ReactElement | null) | undefined
  // The real component invokes this render prop during its own render, and the double has to do
  // the same for the tray to exist at all.
  // eslint-disable-next-line react-hooks/refs -- the shared value and spies are plain test doubles, not React refs
  const tray = renderActions ? renderActions(progress, progress, instance.methods) : null
  // eslint-disable-next-line react-hooks/refs -- children and tray are elements this double only forwards
  return React.createElement(RN.View, { testID: 'mock-swipeable' }, props['children'] as React.ReactNode, tray)
}
