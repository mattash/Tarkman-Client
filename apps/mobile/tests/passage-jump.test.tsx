import { describe, expect, it, jest, afterEach } from '@jest/globals'
import { act, render, screen } from '@testing-library/react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ThemeProvider } from '../design/ThemeProvider'
import { LiturgyText } from '../components/LiturgyText'
import { parseMarkdownSource } from '../design/markdownSource'
import { PartList, type PassageJump } from '../features/live/PartList'
import { type LivePart, normalizeParts } from '../features/live/contracts'

const mockScrollToIndex = jest.fn()
const mockScrollToOffset = jest.fn()
jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  const actual = jest.requireActual<typeof import('@shopify/flash-list')>('@shopify/flash-list')
  return { ...actual, FlashList: React.forwardRef<unknown, { data: LivePart[]; onLoad: () => void; renderItem: (info: { item: LivePart; index: number }) => React.ReactNode }>((props, ref) => {
    React.useImperativeHandle(ref, () => ({ scrollToIndex: mockScrollToIndex, scrollToOffset: mockScrollToOffset }))
    return <View testID="reading-list">{props.data.map((item, index) => <React.Fragment key={item.key}>{props.renderItem({ item, index })}</React.Fragment>)}</View>
  }) }
})
const wrapper = ({ children }: { children: React.ReactNode }) => <GestureHandlerRootView><ThemeProvider scheme="light">{children}</ThemeProvider></GestureHandlerRootView>
afterEach(() => { jest.useRealTimers(); mockScrollToIndex.mockClear(); mockScrollToOffset.mockClear() })

describe('source mapped passage highlight', () => {
  it.each([
    'A **bold** and *italic* with `code`.',
    '[word](https://example.com/word) word',
    'First.\r\n\r\n**Second** 😀',
    'An escaped \\*star and \\\\ slash.',
    '```\r\n\\*literal*\r\n``` tail',
    '![\\*image](https://example.com) tail',
    '**not\r\nmultiline**',
  ])('maps displayed units monotonically to valid raw offsets: %s', source => {
    const { runs, offsets } = parseMarkdownSource(source)
    let previous = 0
    runs.forEach((run, i) => {
      expect(offsets[i]).toHaveLength(run.text.length)
      offsets[i].forEach((range, j) => {
        expect(range.start).toBeGreaterThanOrEqual(previous)
        expect(range.end).toBeGreaterThan(range.start)
        expect(range.end).toBeLessThanOrEqual(source.length)
        const raw = source.slice(range.start, range.end)
        expect(raw === run.text[j] || raw.replace(/\r\n?/g, '\n') === run.text[j] || raw === `\\${run.text[j]}`).toBe(true)
        previous = range.end
      })
    })
  })
  it('skips repeated labels in a link URL before mapping the next plain run', () => {
    const source = '[word](https://example.com/word) word'
    const parsed = parseMarkdownSource(source)
    expect(parsed.offsets[1][1].start).toBe(source.lastIndexOf('word'))
  })
  it('highlights the raw selected occurrence after CRLF stanza separators without losing markdown links', async () => {
    const text = 'First **word**.\r\n\r\nSecond [word](https://example.com).'
    const start = text.lastIndexOf('word')
    await render(<LiturgyText text={text} compactStanzas passageHighlight={{ start, end: start + 4, requestId: 1 }} />, { wrapper })
    expect(screen.getByTestId('passage-highlight-anchor').props.children).toBe('w')
    expect(screen.getByRole('link').props.accessibilityLabel).toBe('word (https://example.com)')
    expect(screen.getByText('First word.').props.selectable).toBe(true)
  })
  it('bounds measurement retries and ignores an in-flight callback after recycling', async () => {
    jest.useFakeTimers()
    const onMeasure = jest.fn()
    const pending: ((x: number, y: number, width: number, height: number) => void)[] = []
    const measureInWindow = jest.fn((callback: (x: number, y: number, width: number, height: number) => void) => { pending.push(callback) })
    const view = await render(<LiturgyText text="word" passageHighlight={{ start: 0, end: 4, requestId: 1, onMeasure }} />, { wrapper })
    screen.getByTestId('passage-highlight-anchor').props.ref.current = { measureInWindow }
    await act(() => { jest.advanceTimersByTime(10000) })
    expect(measureInWindow).toHaveBeenCalledTimes(6)
    await view.rerender(<LiturgyText text="recycled" />)
    pending.forEach(callback => callback(0, 2000, 20, 30))
    expect(onMeasure).not.toHaveBeenCalled()
  })
  it('removes highlight and cancels pending measurement when a recycled text changes', async () => {
    jest.useFakeTimers()
    const onMeasure = jest.fn()
    const view = await render(<LiturgyText text="word" passageHighlight={{ start: 0, end: 4, requestId: 1, onMeasure }} />, { wrapper })
    await view.rerender(<LiturgyText text="different" />)
    await act(() => { jest.runAllTimers() })
    expect(screen.queryByTestId('passage-highlight-anchor')).toBeNull()
    expect(onMeasure).not.toHaveBeenCalled()
  })
})

const parts = normalizeParts({ parts: [
  { part: { id: 1, position: 1, role: 'priest', en: 'First word.', ru: 'Первый' } },
  { part: { id: 2, position: 2, role: 'deacon', en: 'Second word.', ru: 'Второй' } },
] })
function reader(passageJump?: PassageJump, language: 'en' | 'ru' = 'en') {
  return <PartList parts={parts} following={false} language={language} selectedLanguages={['en', 'ru']} manual={() => {}} open={() => {}} passageJump={passageJump} />
}
it('jumps to the occurrence and reissues an identical range only for a new request id', async () => {
  const jump: PassageJump = { key: parts[1].key, language: 'en', start: 7, end: 11, requestId: 1 }
  const view = await render(reader(jump), { wrapper })
  expect(mockScrollToIndex).toHaveBeenLastCalledWith({ index: 1, animated: false, viewPosition: 0 })
  expect(screen.getAllByTestId('passage-highlight-anchor')).toHaveLength(1)
  mockScrollToIndex.mockClear()
  await view.rerender(reader({ ...jump }))
  expect(mockScrollToIndex).not.toHaveBeenCalled()
  await view.rerender(reader({ ...jump, requestId: 2 }))
  expect(mockScrollToIndex).toHaveBeenCalledTimes(1)
  await view.rerender(reader(jump, 'ru'))
  expect(screen.queryByTestId('passage-highlight-anchor')).toBeNull()
})
it('does not scroll a browsing reader without a jump or with an invalid raw range', async () => {
  const view = await render(reader(), { wrapper })
  expect(mockScrollToIndex).not.toHaveBeenCalled()
  await view.rerender(reader({ key: parts[1].key, language: 'en', start: -1, end: 5, requestId: 1 }))
  expect(mockScrollToIndex).not.toHaveBeenCalled()
})
