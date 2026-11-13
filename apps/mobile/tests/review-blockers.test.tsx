import { expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Linking, View } from 'react-native'
import { loadAsync } from 'expo-font'
import { useEffect } from 'react'
import { ReadingFontProvider } from '../design/ReadingFontProvider'
import { ThemeProvider } from '../design/ThemeProvider'
import { LiturgyText } from '../components/LiturgyText'
import { parseMarkdown } from '../design/markdown'
import { AppModal } from '../components/AppModal'

jest.mock('expo-font', () => ({ loadAsync: jest.fn() }))
const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light">{children}</ThemeProvider>

it('keeps the route mounted through font loading, failure, retry and recovery', async () => {
  let finish!: () => void
  jest.mocked(loadAsync).mockRejectedValueOnce(new Error('disk')).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
  const mounted = jest.fn<() => void>()
  function Route() { useEffect(mounted, []); return <LiturgyText text="Հայր մեր" language="grabar" /> }
  await render(<ReadingFontProvider><Route /></ReadingFontProvider>, { wrapper })
  expect(screen.getByText('Հայր մեր')).not.toHaveStyle({ fontFamily: 'NotoSerifArmenian-Regular' })
  expect(screen.getByRole('alert')).toHaveTextContent(/Armenian marks may vary/)
  await fireEvent.press(screen.getByRole('button', { name: 'Retry reading font' }))
  expect(screen.getByText('Հայր մեր')).toBeOnTheScreen()
  await act(async () => finish())
  await waitFor(() => expect(screen.getByText('Հայր մեր')).toHaveStyle({ fontFamily: 'NotoSerifArmenian-Regular' }))
  expect(screen.queryByRole('alert')).toBeNull()
  expect(mounted).toHaveBeenCalledTimes(1)
})
it('preserves line breaks and supports the bounded formatting subset', () => {
  expect(parseMarkdown('First\nline\n\n**bold** *soft* `code`')).toEqual([
    { kind: 'plain', text: 'First\nline\n\n' }, { kind: 'bold', text: 'bold' },
    { kind: 'plain', text: ' ' }, { kind: 'italic', text: 'soft' },
    { kind: 'plain', text: ' ' }, { kind: 'code', text: 'code' },
  ])
})
it.each(['javascript:alert', 'data:text/html,bad', 'http://example.org', '//example.org', 'https://user:pass@example.org', 'https://example.org\\evil', 'https://exa mple.org', 'https://', 'HTTPS://example.org\u0001'])('keeps unsafe URL inert: %s', url => {
  const text = `[Read](${url})`
  expect(parseMarkdown(text)).toEqual([{ kind: 'plain', text }])
})
it.each(['<a href="https://example.org">Read</a>', '![image](https://example.org)', '~~strike~~', '# Heading\n- list', '```\n**literal**\n```', '***nested***', '__unsupported__'])('keeps unsupported markup plain: %s', text => {
  expect(parseMarkdown(text)).toEqual([{ kind: 'plain', text }])
})
it('escapes punctuation without activating markup', () => {
  expect(parseMarkdown('\\*plain\\* \\[Read](https://example.org)')).toEqual([{ kind: 'plain', text: '*plain* [Read](https://example.org)' }])
})
it('opens only explicit HTTPS links and exposes accessible link semantics', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  await render(<LiturgyText text="[Read](https://example.org) [No](javascript:bad)" />, { wrapper })
  const link = screen.getByRole('link', { name: 'Read (https://example.org)' })
  expect(screen.getAllByRole('link')).toHaveLength(1)
  await fireEvent.press(link)
  expect(open).toHaveBeenCalledWith('https://example.org')
  open.mockRejectedValueOnce(new Error('unavailable'))
  await fireEvent.press(link)
  expect(screen.getByRole('alert')).toHaveTextContent(/Could not open the link/)
  open.mockRestore()
})
it('restores the supplied web opener after the dismissal callback', async () => {
  const { Platform } = jest.requireActual<typeof import('react-native')>('react-native')
  const previous = Platform.OS
  Platform.OS = 'web'
  const focus = jest.fn()
  try {
    await render(<AppModal visible title="Focus" onDismiss={() => {}} openerRef={{ current: { focus } as unknown as React.ComponentRef<typeof View> }} />, { wrapper })
    await fireEvent(screen.getByTestId('app-modal'), 'dismiss')
    expect(focus).toHaveBeenCalledTimes(1)
  } finally { Platform.OS = previous }
})

it('keeps stanza boundaries without inventing missing translations at blank edges', async () => {
  await render(<LiturgyText text={'\n\nFirst line\r\nSecond line\n\nThird line\n\n'} compactStanzas />, { wrapper })
  expect(screen.getByText(/First line\s+Second line/)).toBeOnTheScreen()
  expect(screen.getByText('Third line')).toBeOnTheScreen()
  expect(screen.queryByText('Translation not available.')).toBeNull()
})
it('keeps fenced markup inert when using compact stanzas', async () => {
  await render(<LiturgyText text={'```\n[Read](https://example.org)\n\n**literal**\n```'} compactStanzas />, { wrapper })
  expect(screen.queryByRole('link')).toBeNull()
  expect(screen.getByText(/\*\*literal\*\*/)).toBeOnTheScreen()
})
