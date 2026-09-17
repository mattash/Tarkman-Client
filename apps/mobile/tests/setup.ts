import { jest } from '@jest/globals'
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock'

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext)
// FlashList measurement stand-in; see README.md#flashlist-jest-measurement-stand-in.
jest.mock('@shopify/flash-list/dist/recyclerview/utils/measureLayout', () => ({
  ...jest.requireActual<object>('@shopify/flash-list/dist/recyclerview/utils/measureLayout'),
  measureParentSize: jest.fn(() => ({ x: 0, y: 0, width: 402, height: 2000 })),
  measureFirstChildLayout: jest.fn(() => ({ x: 0, y: 0, width: 402, height: 2000 })),
  measureItemLayout: jest.fn(() => ({ x: 0, y: 0, width: 402, height: 100 })),
}))

// Reanimated's UI runtime cannot load in Jest: react-native-worklets reaches for its native
// module at import. The official mocks stand in for both; the one behaviour they omit that the
// reading list needs is useAnimatedReaction observing shared values, so here a shared value
// write notifies registered reactions synchronously, as the worklet runtime does per frame.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'))
jest.mock('react-native-reanimated', () => {
  // The mock exposes the reanimated surface we don't override; we only need it as a bag of unknown values
  // to spread, since the real module's exports don't fully match the mock's shape for typecheck purposes.
  const reanimated = jest.requireActual('react-native-reanimated/mock') as Record<string, unknown>
  const mockReact = jest.requireActual('react') as typeof import('react')
  // A type alias here would trip jest's out-of-scope check on the factory, so the array carries the shape.
  const mockReactions: Array<{ prepare(): unknown; react(next: unknown, previous: unknown): void; previous: unknown }> = []
  const mockNotify = () => {
    // A reaction may mount or unmount another one, so iterate a snapshot.
    for (const r of [...mockReactions]) {
      const next = r.prepare()
      if (next !== r.previous) {
        const previous = r.previous
        r.previous = next
        r.react(next, previous)
      }
    }
  }
  const mockBox = <Value>(initial: Value) => {
    const box = { value: initial }
    const mockWrite = (next: Value | ((current: Value) => Value)) => {
      box.value = typeof next === 'function' ? (next as (mockCurrent: Value) => Value)(box.value) : next
      mockNotify()
    }
    return new Proxy(box, {
      get(_target, property) {
        if (property === 'value') return box.value
        if (property === 'get') return () => box.value
        if (property === 'set') return mockWrite
      },
      set(_target, property, next) {
        if (property !== 'value') return false
        box.value = next
        mockNotify()
        return true
      },
    })
  }
  return { ...reanimated,
    // A shared value has to outlive the render that created it, as the real hook's does: a reaction
    // registered on one render otherwise keeps writing to the value the next render threw away.
    useSharedValue: <Value>(initial: Value) => {
      const held = mockReact.useRef<{ value: Value } | null>(null)
      held.current ??= mockBox(initial)
      return held.current
    },
    // Registration follows mount and unmount, so an unmounted row's reaction stops observing.
    useAnimatedReaction: (prepare: () => unknown, react: (next: unknown, previous: unknown) => void) => {
      const held = mockReact.useRef<(typeof mockReactions)[number] | null>(null)
      if (held.current) Object.assign(held.current, { prepare, react })
      else held.current = { prepare, react, previous: prepare() }
      const entry = held.current
      mockReact.useEffect(() => {
        mockReactions.push(entry)
        return () => {
          const at = mockReactions.indexOf(entry)
          if (at >= 0) mockReactions.splice(at, 1)
        }
      }, [entry])
    } }
})
