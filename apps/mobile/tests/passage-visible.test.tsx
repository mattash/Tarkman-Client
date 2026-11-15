import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { LiturgyText, type VisibleTextLayout } from '../components/LiturgyText'
import { parseMarkdownSource } from '../design/markdownSource'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import type { ReadingSize } from '../design/tokens'
import { ThemeProvider } from '../design/ThemeProvider'
import { ReadingFontContext } from '../design/readingFont'
import { PartList } from '../features/live/PartList'
import { normalizeParts, type LivePart } from '../features/live/contracts'

let mockTextTop = 0
let mockTextWidth = 400
let mockMeasurements = 0
let mockWebNode: object | undefined
let mockDimensions = { width: 390, height: 844, scale: 3, fontScale: 1 }
const mockStanzaFrames = new Map<string, { y: number; height: number }>()
let mockDeferStanzaMeasurements = false
let mockStanzaNodeVersion = 0
let mockParentNodeVersion = 0
const mockPendingStanzaMeasurements: (() => void)[] = []
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDimensions }))
jest.mock('react-native', () => {
  const actual = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')
  const mocked = Object.create(actual)
  Object.defineProperty(mocked, 'View', { value: React.forwardRef((props: import('react-native').ViewProps, ref) => {
    const nodeVersion = props.testID?.startsWith('visible-stanza-') ? mockStanzaNodeVersion : mockParentNodeVersion
    const node = React.useMemo(() => {
      const nativeFrame = () => mockStanzaFrames.get(props.testID ?? '')
      const deliver = (report: () => void) => {
        if (mockDeferStanzaMeasurements && props.testID?.startsWith('visible-stanza-')) mockPendingStanzaMeasurements.push(report)
        else report()
      }
      return {
        nodeVersion,
        measure: (done: (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void) => {
          const frame = nativeFrame()
          const width = mockTextWidth, top = mockTextTop
          if (frame) deliver(() => done(0, frame.y, width, frame.height, 0, top + frame.y))
        },
        measureInWindow: (done: (x: number, y: number, width: number, height: number) => void) => {
          mockMeasurements++
          const frame = nativeFrame()
          if (props.testID?.startsWith('visible-stanza-') && !frame) { done(0, 0, 0, 0); return }
          const top = props.testID === 'reading-frame' ? 0 : mockTextTop + (frame?.y ?? 0)
          const width = props.testID === 'reading-frame' ? 400 : mockTextWidth
          const height = props.testID === 'reading-frame' ? 80 : frame?.height ?? 100000
          deliver(() => done(0, top, width, height))
        },
      }
    }, [nodeVersion, props.testID])
    React.useImperativeHandle(ref, () => mockWebNode ?? node)
    return <actual.View {...props} />
  }) })
  Object.defineProperty(mocked, 'Text', { value: React.forwardRef((props: import('react-native').TextProps, ref) => {
    // Outer native Text owns real bounds; nested VirtualText is not a measurable View.
    React.useImperativeHandle(ref, () => ({ measureInWindow: (done: (x: number, y: number, width: number, height: number) => void) => {
      done(0, mockTextTop, mockTextWidth, 100000)
    } }))
    return <actual.Text {...props} />
  }) })
  return mocked
})
jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  const actual = jest.requireActual<typeof import('@shopify/flash-list')>('@shopify/flash-list')
  return { ...actual, FlashList: React.forwardRef((props: { data: LivePart[]; onScroll: (event: unknown) => void; renderItem: (info: { item: LivePart; index: number }) => React.ReactNode }, ref) => {
    React.useImperativeHandle(ref, () => ({ scrollToIndex() {}, scrollToOffset() {} }))
    // A constant recycled slot, rather than keyed occurrence instances.
    return <View testID="reading-list" {...{ onScroll: props.onScroll }}>{props.data.map((item, index) => <React.Fragment key={index}>{props.renderItem({ item, index })}</React.Fragment>)}</View>
  }) }
})
const wrapper = ({ children }: { children: React.ReactNode }) => <GestureHandlerRootView><ThemeProvider scheme="light">{children}</ThemeProvider></GestureHandlerRootView>
function parts(text: string | null, id = 1) {
  return normalizeParts({ parts: [{ part: { id, position: id, role: 'priest', en: text, ru: 'Перевод' } }] })
}
function reader(data: LivePart[], callback?: (passage: { key: string; language: string; start: number; end: number }) => void, readingSize?: ReadingSize) {
  return <PartList readingSize={readingSize} parts={data} following={false} language="en" selectedLanguages={['en']} manual={() => {}} open={() => {}} passageVisible={callback} />
}
async function layout(text: string, displayedLines: string[], height = 20) {
  await fireEvent(screen.getByText(text), 'textLayout', { nativeEvent: { lines: displayedLines.map((text, index) => ({ text, y: index * height, height })) } })
}
function measuredRange(layout: VisibleTextLayout, top: number, bottom: number) {
  layout.measure(() => {})
  return layout.range(top, bottom)
}
async function settle() { await act(() => { jest.advanceTimersByTime(120) }) }
async function scroll(top: number) {
  mockTextTop = -top
  await fireEvent.scroll(screen.getByTestId('reading-list'), { nativeEvent: { contentOffset: { y: top } } })
  await settle()
}
afterEach(() => {
  jest.useRealTimers(); jest.restoreAllMocks(); mockTextTop = 0; mockTextWidth = 400; mockMeasurements = 0; mockWebNode = undefined
  mockDimensions = { width: 390, height: 844, scale: 3, fontScale: 1 }
  mockStanzaFrames.clear(); mockDeferStanzaMeasurements = false; mockStanzaNodeVersion = 0; mockParentNodeVersion = 0; mockPendingStanzaMeasurements.length = 0
})

describe('precise optional visible passages', () => {
  it('uses bounded actual glyph geometry on web without onTextLayout or pixel/source interpolation', async () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    const source = 'Visible 😀 **word**. '.repeat(200)
    const parsed = parseMarkdownSource(source)
    const displayed = parsed.runs.map(run => run.text).join('')
    const positions = parsed.offsets.flat()
    const textNode = { textContent: displayed }
    let index = 0
    const rect = jest.fn(() => ({ top: Math.floor(index / 30) * 20, bottom: Math.floor(index / 30) * 20 + 20 }))
    mockWebNode = {
      getBoundingClientRect: () => ({ top: 0 }),
      ownerDocument: {
        createTreeWalker: () => { let visited = false; return { nextNode: () => { if (visited) return null; visited = true; return textNode } } },
        createRange: () => ({ setStart: (_node: unknown, offset: number) => { index = offset }, setEnd() {}, getBoundingClientRect: rect }),
      },
    }
    let measured: VisibleTextLayout | undefined
    await render(<LiturgyText text={source} registerVisibleText={layout => { measured = layout; return () => {} }} />, { wrapper })
    const actual = measured!.range(200, 280)
    let start = 300, end = 330
    while (/\s/u.test(displayed[start])) start++
    if (/[\uDC00-\uDFFF]/u.test(displayed[start])) start--
    while (/\s/u.test(displayed[end - 1])) end--
    expect(actual).toEqual({ start: positions[start].start, end: positions[end - 1].end })
    expect(rect.mock.calls.length).toBeLessThan(32)
  })

  it('reports different original source lines while scrolling inside one very long occurrence, throttling and deduplicating', async () => {
    jest.useFakeTimers()
    const lines = Array.from({ length: 300 }, (_, index) => `Line ${index} 😀 original.`)
    const source = lines.map((line, index) => index === 100 ? `**${line}**` : line).join('\r\n')
    const data = parts(source)
    const callback = jest.fn()
    await render(reader(data, callback), { wrapper })
    await layout(lines.join('\n'), lines)
    await settle()
    expect(callback).toHaveBeenLastCalledWith({ key: data[0].key, language: 'en', start: 0, end: lines[0].length })
    mockTextTop = -2000
    for (let i = 0; i < 30; i++) await fireEvent.scroll(screen.getByTestId('reading-list'), { nativeEvent: { contentOffset: { y: 2000 } } })
    const before = mockMeasurements
    await settle()
    expect(mockMeasurements - before).toBe(2) // viewport + mounted text, not every line
    const start = source.indexOf(lines[100])
    expect(callback).toHaveBeenLastCalledWith({ key: data[0].key, language: 'en', start, end: start + lines[100].length })
    await scroll(2000)
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('maps deep scrolling within a long later stanza back through raw CRLF separators', async () => {
    jest.useFakeTimers()
    const later = Array.from({ length: 150 }, (_, index) => `Later ${index}.`)
    const first = 'Opening.'
    const source = `${first}\r\n\r\n${later.join('\r\n')}`
    const callback = jest.fn()
    const data = parts(source)
    await render(reader(data, callback), { wrapper })
    await layout(first, [first])
    await layout(later.join('\n'), later)
    await fireEvent(screen.getByTestId('visible-stanza-0'), 'layout', { nativeEvent: { layout: { y: 0, height: 20, width: 400 } } })
    await fireEvent(screen.getByTestId(`visible-stanza-${first.length + 4}`), 'layout', { nativeEvent: { layout: { y: 40, height: 3000, width: 400 } } })
    await scroll(2040)
    const start = source.indexOf('Later 100.')
    expect(callback).toHaveBeenLastCalledWith({ key: data[0].key, language: 'en', start, end: start + 'Later 100.'.length })
  })

  it.each(['layout-first', 'text-layout-first'] as const)('qualifies child stanza ranges against measured wrapper width with %s reflow events', async order => {
    jest.useFakeTimers()
    const first = 'Opening.'
    const later = ['Later first.', 'Later second.']
    const source = `${first}\r\n\r\n${later.join('\r\n')}`
    const data = parts(source)
    const callback = jest.fn()
    mockStanzaFrames.set('visible-stanza-0', { y: 0, height: 20 })
    mockStanzaFrames.set(`visible-stanza-${first.length + 4}`, { y: 40, height: 80 })
    await render(reader(data, callback), { wrapper })
    const childLayout = (width: number) => fireEvent(screen.getByText(later.join('\n')), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height: 80 } } })
    await childLayout(400)
    await layout(first, [first])
    await layout(later.join('\n'), later)
    await fireEvent(screen.getByTestId('visible-stanza-0'), 'layout', { nativeEvent: { layout: { y: 0, height: 20, width: 400 } } })
    await fireEvent(screen.getByTestId(`visible-stanza-${first.length + 4}`), 'layout', { nativeEvent: { layout: { y: 40, height: 80, width: 400 } } })
    await settle()
    expect(callback).toHaveBeenLastCalledWith({ key: data[0].key, language: 'en', start: 0, end: first.length })
    callback.mockClear()
    // Reflow can precede both wrapper and child layout events. The wrapper's actual
    // measured width must reach the child range lookup, not permit its old lines.
    mockTextWidth = 240
    await scroll(40)
    expect(callback).not.toHaveBeenCalled()
    if (order === 'layout-first') {
      await childLayout(240)
      await scroll(40)
      expect(callback).not.toHaveBeenCalled()
      await layout(later.join('\n'), later, 40)
    } else {
      await layout(later.join('\n'), later, 40)
      await scroll(40)
      expect(callback).not.toHaveBeenCalled()
      await childLayout(240)
    }
    await scroll(40)
    const start = source.indexOf(later[0])
    expect(callback).toHaveBeenLastCalledWith({ key: data[0].key, language: 'en', start, end: start + later[0].length })
  })

  it.each(['fontReady', 'style', 'fontScale'] as const)('recovers unchanged native stanza frames after %s changes without a synthetic wrapper onLayout', async changed => {
    jest.useFakeTimers()
    const first = 'Opening.'
    const later = ['Later first.', 'Later second.']
    const source = `${first}\r\n\r\n${later.join('\r\n')}`
    const stanzaID = `visible-stanza-${first.length + 4}`
    mockStanzaFrames.set('visible-stanza-0', { y: 0, height: 20 })
    mockStanzaFrames.set(stanzaID, { y: 40, height: 40 })
    let visible: VisibleTextLayout | undefined
    const register = (value: VisibleTextLayout) => { visible = value; return () => {} }
    const make = (next: boolean) => <ReadingFontContext.Provider value={!(next && changed === 'fontReady')}>
      <LiturgyText compactStanzas text={source} registerVisibleText={register} style={next && changed === 'style' ? { fontSize: 25 } : undefined} />
    </ReadingFontContext.Provider>
    const view = await render(make(false), { wrapper })
    await layout(first, [first])
    await layout(later.join('\n'), later)
    await fireEvent(screen.getByTestId('visible-stanza-0'), 'layout', { nativeEvent: { layout: { y: 0, height: 20, width: 400 } } })
    await fireEvent(screen.getByTestId(stanzaID), 'layout', { nativeEvent: { layout: { y: 40, height: 40, width: 400 } } })
    const start = source.indexOf(later[0])
    expect(measuredRange(visible!, 40, 80)).toEqual({ start, end: start + later[0].length })
    if (changed === 'fontScale') mockDimensions = { ...mockDimensions, fontScale: 1.5 }
    await view.rerender(make(true))
    expect(measuredRange(visible!, 40, 80)).toBeUndefined()
    await layout(first, [first])
    await layout(later.join('\n'), later)
    // Fabric need not emit another wrapper onLayout when its frame is unchanged.
    // A bounded current native measurement, not an invented layout event, must recover.
    measuredRange(visible!, 40, 80)
    await settle()
    expect(measuredRange(visible!, 40, 80)).toEqual({ start, end: start + later[0].length })
  })

  it('bounds unchanged-frame recovery reads for a deep stanza instead of measuring every stanza', async () => {
    jest.useFakeTimers()
    const stanzas = Array.from({ length: 128 }, (_, index) => `Stanza ${index}.`)
    const source = stanzas.join('\n\n')
    let offset = 0
    for (const [index, stanza] of stanzas.entries()) {
      mockStanzaFrames.set(`visible-stanza-${offset}`, { y: index * 40, height: 20 })
      offset += stanza.length + 2
    }
    const target = stanzas[100], start = source.indexOf(target)
    let visible: VisibleTextLayout | undefined
    const register = (value: VisibleTextLayout) => { visible = value; return () => {} }
    const make = (next: boolean) => <LiturgyText compactStanzas text={source} registerVisibleText={register} style={{ fontSize: next ? 25 : 24 }} />
    const view = await render(make(false), { wrapper })
    await layout(target, [target])
    await fireEvent(screen.getByTestId(`visible-stanza-${start}`), 'layout', { nativeEvent: { layout: { y: 4000, height: 20, width: 400 } } })
    expect(measuredRange(visible!, 4000, 4020)).toEqual({ start, end: start + target.length })
    await view.rerender(make(true))
    await layout(target, [target])
    const before = mockMeasurements
    measuredRange(visible!, 4000, 4020)
    await settle()
    expect(measuredRange(visible!, 4000, 4020)).toEqual({ start, end: start + target.length })
    expect(mockMeasurements - before).toBeLessThan(24)
  })

  it.each(['geometry', 'node', 'parentNode', 'parentMove', 'width'] as const)('rejects an in-flight stanza-frame recovery after a %s change', async changed => {
    jest.useFakeTimers()
    const first = 'Opening.'
    const later = ['Later first.', 'Later second.']
    const source = `${first}\r\n\r\n${later.join('\r\n')}`
    const stanzaID = `visible-stanza-${first.length + 4}`
    mockStanzaFrames.set('visible-stanza-0', { y: 0, height: 20 })
    mockStanzaFrames.set(stanzaID, { y: 40, height: 40 })
    let visible: VisibleTextLayout | undefined
    const register = (value: VisibleTextLayout) => { visible = value; return () => {} }
    const make = (revision: number) => <LiturgyText compactStanzas text={source} registerVisibleText={register} style={{ fontSize: 24 + revision }} />
    const view = await render(make(0), { wrapper })
    await layout(first, [first])
    await layout(later.join('\n'), later)
    await fireEvent(screen.getByTestId('visible-stanza-0'), 'layout', { nativeEvent: { layout: { y: 0, height: 20, width: 400 } } })
    await fireEvent(screen.getByTestId(stanzaID), 'layout', { nativeEvent: { layout: { y: 40, height: 40, width: 400 } } })
    const start = source.indexOf(later[0])
    expect(measuredRange(visible!, 40, 80)).toEqual({ start, end: start + later[0].length })
    await view.rerender(make(1))
    await layout(first, [first])
    await layout(later.join('\n'), later)
    mockDeferStanzaMeasurements = true
    expect(measuredRange(visible!, 40, 80)).toBeUndefined()
    expect(mockPendingStanzaMeasurements.length).toBeGreaterThan(0)
    if (changed === 'geometry') await view.rerender(make(2))
    if (changed === 'node') { mockStanzaNodeVersion++; await view.rerender(make(1)) }
    if (changed === 'parentNode') { mockParentNodeVersion++; await view.rerender(make(1)) }
    if (changed === 'parentMove') mockTextTop = -10
    if (changed === 'width') mockTextWidth = 240
    await act(() => {
      for (let reads = 0; reads < 20 && mockPendingStanzaMeasurements.length; reads++) {
        mockPendingStanzaMeasurements.splice(0).forEach(report => report())
      }
    })
    expect(mockPendingStanzaMeasurements).toHaveLength(0)
    expect(measuredRange(visible!, 40, 80)).toBeUndefined()
    mockDeferStanzaMeasurements = false
    mockTextTop = 0
    await act(() => { mockPendingStanzaMeasurements.splice(0).forEach(report => report()) })
    await fireEvent(screen.getByText(later.join('\n')), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: mockTextWidth, height: 40 } } })
    await layout(first, [first])
    await layout(later.join('\n'), later)
    measuredRange(visible!, 40, 80)
    await settle()
    expect(measuredRange(visible!, 40, 80)).toEqual({ start, end: start + later[0].length })
  })

  it('rejects stale stanza y offsets while current native bounds are in flight after a context change', async () => {
    jest.useFakeTimers()
    const first = 'Opening.'
    const later = ['Later first.', 'Later second.']
    const source = `${first}\r\n\r\n${later.join('\r\n')}`
    const data = parts(source)
    const callback = jest.fn()
    mockStanzaFrames.set('visible-stanza-0', { y: 0, height: 20 })
    mockStanzaFrames.set(`visible-stanza-${first.length + 4}`, { y: 40, height: 40 })
    const view = await render(reader(data, callback), { wrapper })
    await layout(first, [first])
    await layout(later.join('\n'), later)
    await fireEvent(screen.getByTestId('visible-stanza-0'), 'layout', { nativeEvent: { layout: { y: 0, height: 20, width: 400 } } })
    const stanza = screen.getByTestId(`visible-stanza-${first.length + 4}`)
    await fireEvent(stanza, 'layout', { nativeEvent: { layout: { y: 40, height: 40, width: 400 } } })
    await settle()
    expect(callback).toHaveBeenLastCalledWith({ key: data[0].key, language: 'en', start: 0, end: first.length })
    callback.mockClear()
    await view.rerender(reader(data, callback, 'larger'))
    mockStanzaFrames.set(`visible-stanza-${first.length + 4}`, { y: 80, height: 80 })
    mockDeferStanzaMeasurements = true
    await fireEvent(screen.getByText(later.join('\n')), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 80 } } })
    await layout(later.join('\n'), later, 40)
    // Old y=40 would select Later second.; the current stanza actually starts at80.
    await scroll(80)
    expect(callback).not.toHaveBeenCalled()
    expect(mockPendingStanzaMeasurements.length).toBeGreaterThan(0)
    mockDeferStanzaMeasurements = false
    await act(() => { mockPendingStanzaMeasurements.splice(0).forEach(report => report()) })
    await scroll(80)
    const start = source.indexOf(later[0])
    expect(callback).toHaveBeenLastCalledWith({ key: data[0].key, language: 'en', start, end: start + later[0].length })
  })

  it('discards recycled row geometry and reports fresh source identity after reflow', async () => {
    jest.useFakeTimers()
    const callback = jest.fn()
    const first = parts('Old line.\nOld next.')
    const view = await render(reader(first, callback), { wrapper })
    await layout('Old line.\nOld next.', ['Old line.', 'Old next.'])
    await settle()
    const next = parts('Fresh 😀 line.\nFresh next.', 2)
    await view.rerender(reader(next, callback))
    await settle()
    expect(callback).toHaveBeenCalledTimes(1)
    await layout('Fresh 😀 line.\nFresh next.', ['Fresh 😀 line.', 'Fresh next.'], 40)
    await scroll(40)
    expect(callback).toHaveBeenLastCalledWith({ key: next[0].key, language: 'en', start: 'Fresh 😀 line.\n'.length, end: next[0].text.en!.length })
  })

  it('keeps source identity across larger-text reflow and does not loop when parent callbacks change', async () => {
    jest.useFakeTimers()
    const source = 'First **word** next.'
    const data = parts(source)
    const first = jest.fn(), latest = jest.fn()
    const view = await render(reader(data, first), { wrapper })
    await layout('First word next.', ['First word next.'])
    await settle()
    await view.rerender(reader(data, latest))
    await scroll(0)
    expect(latest).not.toHaveBeenCalled()
    await view.rerender(reader(data, latest, 'larger'))
    await scroll(40)
    expect(latest).not.toHaveBeenCalled()
    await layout('First word next.', ['First word', ' next.'], 40)
    await scroll(40)
    expect(latest).toHaveBeenCalledTimes(1)
    expect(latest).toHaveBeenLastCalledWith({ key: data[0].key, language: 'en', start: source.indexOf('next.'), end: source.length })
  })

  it('does not report unavailable translations or measure for unchanged callers without the optional callback', async () => {
    jest.useFakeTimers()
    const callback = jest.fn()
    const view = await render(reader(parts(null), callback), { wrapper })
    await settle()
    expect(callback).not.toHaveBeenCalled()
    await view.rerender(reader(parts('Normal text.')))
    await settle()
    const before = mockMeasurements
    await scroll(10)
    expect(mockMeasurements).toBe(before)
  })
})
