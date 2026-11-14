import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { LiturgyText, type VisibleTextLayout } from '../components/LiturgyText'
import { parseMarkdownSource } from '../design/markdownSource'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import type { ReadingSize } from '../design/tokens'
import { ThemeProvider } from '../design/ThemeProvider'
import { PartList } from '../features/live/PartList'
import { normalizeParts, type LivePart } from '../features/live/contracts'

let mockTextTop = 0
let mockMeasurements = 0
let mockWebNode: object | undefined
jest.mock('react-native', () => {
  const actual = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')
  const mocked = Object.create(actual)
  Object.defineProperty(mocked, 'View', { value: React.forwardRef((props: import('react-native').ViewProps, ref) => {
    React.useImperativeHandle(ref, () => mockWebNode ?? ({ measureInWindow: (done: (x: number, y: number, width: number, height: number) => void) => {
      mockMeasurements++
      done(0, props.testID === 'reading-frame' ? 0 : mockTextTop, 400, props.testID === 'reading-frame' ? 80 : 100000)
    } }))
    return <actual.View {...props} />
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
async function settle() { await act(() => { jest.advanceTimersByTime(120) }) }
async function scroll(top: number) {
  mockTextTop = -top
  await fireEvent.scroll(screen.getByTestId('reading-list'), { nativeEvent: { contentOffset: { y: top } } })
  await settle()
}
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); mockTextTop = 0; mockMeasurements = 0; mockWebNode = undefined })

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
    await fireEvent(screen.getByTestId('visible-stanza-0'), 'layout', { nativeEvent: { layout: { y: 0, height: 20 } } })
    await fireEvent(screen.getByTestId(`visible-stanza-${first.length + 4}`), 'layout', { nativeEvent: { layout: { y: 40, height: 3000 } } })
    await scroll(2040)
    const start = source.indexOf('Later 100.')
    expect(callback).toHaveBeenLastCalledWith({ key: data[0].key, language: 'en', start, end: start + 'Later 100.'.length })
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
