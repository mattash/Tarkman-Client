import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { act, render } from '@testing-library/react-native'
import { Platform, type Text } from 'react-native'
import type { ComponentRef, ReactNode } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import type { PassageHighlight } from '../components/LiturgyText'
import { ThemeProvider } from '../design/ThemeProvider'
import { spacing } from '../design/tokens'
import { PartList, type PassageJump } from '../features/live/PartList'
import { normalizeParts, type LivePart } from '../features/live/contracts'

// Isolate PartList's JS/API contract. These mocks do not model glyph measurement,
// UIKit accessibility focus, audible VoiceOver output, or real list virtualization.
let mockHighlight: PassageHighlight | undefined
let mockViewportHeight = 400
let mockDeferViewport = false
const mockPendingViewport: (() => void)[] = []
const mockScrollToIndex = jest.fn()
const mockScrollToOffset = jest.fn()
const mockFindNodeHandle = jest.fn<(node: unknown) => number | null>()
const mockSetAccessibilityFocus = jest.fn()
const mockAnnounceForAccessibility = jest.fn()
const viewportTop = 100
const scrollOffset = 300

jest.mock('../components/LiturgyText', () => ({ LiturgyText: (props: { passageHighlight?: PassageHighlight }) => {
  mockHighlight = props.passageHighlight
  return null
} }))
jest.mock('react-native', () => {
  const actual = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')
  const mocked = Object.create(actual)
  Object.defineProperty(mocked, 'View', { value: React.forwardRef((props: import('react-native').ViewProps, ref) => {
    React.useImperativeHandle(ref, () => ({ measureInWindow: (done: (x: number, y: number, width: number, height: number) => void) => {
      const report = () => done(0, viewportTop, 390, mockViewportHeight)
      if (mockDeferViewport) mockPendingViewport.push(report)
      else report()
    } }))
    return <actual.View {...props} />
  }) })
  Object.defineProperty(mocked, 'findNodeHandle', { get: () => mockFindNodeHandle })
  Object.defineProperty(mocked, 'AccessibilityInfo', { value: {
    ...actual.AccessibilityInfo,
    setAccessibilityFocus: (handle: number) => mockSetAccessibilityFocus(handle),
    announceForAccessibility: (announcement: string) => mockAnnounceForAccessibility(announcement),
  } })
  return mocked
})
jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const actual = jest.requireActual<typeof import('@shopify/flash-list')>('@shopify/flash-list')
  return { ...actual, FlashList: React.forwardRef((props: { data: LivePart[]; renderItem(info: { item: LivePart; index: number; target: 'Cell' }): ReactNode }, ref) => {
    React.useImperativeHandle(ref, () => ({
      scrollToIndex: mockScrollToIndex,
      scrollToOffset: mockScrollToOffset,
      getAbsoluteLastScrollOffset: () => scrollOffset,
    }))
    return <>{props.data.map((item, index) => <React.Fragment key={item.key}>{props.renderItem({ item, index, target: 'Cell' })}</React.Fragment>)}</>
  }) }
})

const source = 'Opening 😀\r\n**Peace 😀 be with you.**\r\nEnding.'
const selected = '**Peace 😀 be with you.**'
const parts = normalizeParts({ parts: [{ part: { id: 1, position: 1, role: 'priest', en: source } }] })
const jump: PassageJump = { key: parts[0].key, language: 'en', start: source.indexOf(selected), end: source.indexOf(selected) + selected.length, requestId: 1, focus: true }
const anchor = { testAnchor: 'measured nested text' } as unknown as ComponentRef<typeof Text>
const wrapper = ({ children }: { children: ReactNode }) => <GestureHandlerRootView><ThemeProvider scheme="light">{children}</ThemeProvider></GestureHandlerRootView>
function reader(request: PassageJump = jump, readingSize: 'standard' | 'larger' = 'standard') {
  return <PartList parts={parts} following={false} language="en" selectedLanguages={['en']} manual={() => {}} open={() => {}} passageJump={request} readingSize={readingSize} />
}
async function measure(y = viewportTop + spacing.md, highlight = mockHighlight!) {
  await act(() => { highlight.onMeasure?.(y, 24, anchor) })
}
function expectNoFocus() {
  expect(mockFindNodeHandle).not.toHaveBeenCalled()
  expect(mockSetAccessibilityFocus).not.toHaveBeenCalled()
  expect(mockAnnounceForAccessibility).not.toHaveBeenCalled()
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.replaceProperty(Platform, 'OS', 'ios')
  jest.spyOn(Date, 'now').mockReturnValue(1000)
  mockFindNodeHandle.mockReturnValue(276)
  mockHighlight = undefined
  mockViewportHeight = 400
  mockDeferViewport = false
  mockPendingViewport.length = 0
})
afterEach(() => { jest.restoreAllMocks() })

describe('PartList native accessibility API intent (not native focus proof)', () => {
  it('waits for a current visible measurement, scrolls offscreen geometry first, and focuses then announces raw UTF-16 source once', async () => {
    await render(reader(), { wrapper })
    expect(mockScrollToIndex).toHaveBeenCalledWith({ index: 0, animated: false, viewPosition: 0 })
    expect(mockHighlight).toMatchObject({ start: jump.start, end: jump.end, requestId: 1 })
    expectNoFocus()

    const offscreenY = viewportTop + mockViewportHeight + 200
    await measure(offscreenY)
    expect(mockScrollToOffset).toHaveBeenLastCalledWith({ offset: scrollOffset + offscreenY - viewportTop - spacing.md, animated: false })
    expectNoFocus()

    await measure()
    expect(mockFindNodeHandle).toHaveBeenCalledWith(anchor)
    expect(mockSetAccessibilityFocus).toHaveBeenCalledWith(276)
    // Includes markdown, CRLF-sensitive source offsets and a surrogate pair: not
    // normalized/displayed text, a role label, or the entire occurrence.
    expect(mockAnnounceForAccessibility).toHaveBeenCalledWith(selected)
    expect(mockScrollToOffset.mock.invocationCallOrder[0]).toBeLessThan(mockSetAccessibilityFocus.mock.invocationCallOrder[0])
    expect(mockSetAccessibilityFocus.mock.invocationCallOrder[0]).toBeLessThan(mockAnnounceForAccessibility.mock.invocationCallOrder[0])
    await measure()
    await measure()
    expect(mockFindNodeHandle).toHaveBeenCalledTimes(1)
    expect(mockSetAccessibilityFocus).toHaveBeenCalledTimes(1)
    expect(mockAnnounceForAccessibility).toHaveBeenCalledTimes(1)
  })

  it('allows the same source range to focus again for a fresh requestId', async () => {
    const view = await render(reader(), { wrapper })
    await measure()
    await view.rerender(reader({ ...jump, requestId: 2 }))
    expect(mockSetAccessibilityFocus).toHaveBeenCalledTimes(1)
    await measure()
    await measure()
    expect(mockSetAccessibilityFocus).toHaveBeenCalledTimes(2)
    expect(mockAnnounceForAccessibility).toHaveBeenNthCalledWith(2, selected)
    expect(mockAnnounceForAccessibility).toHaveBeenCalledTimes(2)
  })

  it('rejects both retained and already in-flight callbacks from a previous request', async () => {
    const view = await render(reader(), { wrapper })
    const stale = mockHighlight!
    mockDeferViewport = true
    await measure(undefined, stale)
    expect(mockPendingViewport).toHaveLength(1)
    await view.rerender(reader({ ...jump, requestId: 2 }))
    await act(() => { mockPendingViewport.splice(0).forEach(report => report()) })
    mockDeferViewport = false
    await measure(undefined, stale)
    expectNoFocus()
    await measure()
    expect(mockSetAccessibilityFocus).toHaveBeenCalledTimes(1)
    expect(mockAnnounceForAccessibility).toHaveBeenCalledTimes(1)
  })

  it('does not steal focus for focus:false restoration or larger-text resize requests', async () => {
    const view = await render(reader({ ...jump, focus: false }), { wrapper })
    await measure(viewportTop + 600)
    await measure()
    await view.rerender(reader({ ...jump, focus: false, requestId: 2 }, 'larger'))
    await measure()
    expect(mockScrollToIndex).toHaveBeenCalledTimes(2)
    expect(mockScrollToOffset).toHaveBeenCalledTimes(1)
    expectNoFocus()
  })

  it('waits for a nonempty viewport and discards measurements after the request deadline', async () => {
    await render(reader(), { wrapper })
    mockViewportHeight = 0
    await measure()
    expectNoFocus()
    mockViewportHeight = 400
    mockDeferViewport = true
    await measure()
    jest.mocked(Date.now).mockReturnValue(3201)
    await act(() => { mockPendingViewport.splice(0).forEach(report => report()) })
    mockDeferViewport = false
    await measure()
    expectNoFocus()
  })

  it.each([
    { start: -1 }, { end: source.length + 1 }, { end: jump.start }, { start: 1.5 }, { key: 'missing' }, { language: 'ru' as const },
  ])('never exposes a focus measurement callback for an invalid request: %j', async invalid => {
    await render(reader({ ...jump, ...invalid }), { wrapper })
    expect(mockHighlight).toBeUndefined()
    expect(mockScrollToIndex).not.toHaveBeenCalled()
    expectNoFocus()
  })
})
