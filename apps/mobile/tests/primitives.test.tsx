import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { AppButton } from '../components/AppButton'
import { LiturgyText } from '../components/LiturgyText'
import { TextField } from '../components/TextField'
import { AppModal } from '../components/AppModal'
import { ReadingFontContext } from '../design/readingFont'
import { colors } from '../design/tokens'
import { prayer, marksSample } from '../design/samples'

const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light"><ReadingFontContext.Provider value={true}>{children}</ReadingFontContext.Provider></ThemeProvider>

describe('native primitives', () => {
  it('invokes an enabled action and suppresses disabled/loading actions', async () => {
    const action = jest.fn()
    await render(<><AppButton onPress={action}>Read</AppButton><AppButton disabled onPress={action}>Disabled</AppButton><AppButton loading onPress={action}>Loading</AppButton></>, { wrapper })
    await fireEvent.press(screen.getByRole('button', { name: 'Read' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Disabled' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Loading' }))
    expect(action).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Loading' }).props.accessibilityState).toEqual({ busy: true, disabled: true })
  })
  it('preserves paragraphs, marks, selection, language and text scaling', async () => {
    const text = prayer.grabar + '\n\n' + marksSample
    await render(<LiturgyText text={text} language="grabar" />, { wrapper })
    const reading = screen.getByText(text, { exact: true })
    expect(reading).toHaveTextContent(text)
    expect(reading.props.selectable).toBe(true)
    expect(reading.props.allowFontScaling).toBe(true)
    expect(reading.props.accessibilityLanguage).toBe('hy')
    expect(reading).toHaveStyle({ fontFamily: 'NotoSerifArmenian-Regular' })
  })
  it.each([null, '', '   '])('makes missing translation explicit: %s', async text => {
    await render(<LiturgyText text={text} language="grabar" />, { wrapper })
    expect(screen.getByText('Translation not available.').props.accessibilityLanguage).toBe('en')
  })
  it('keeps markup literal and honors a nonselectable muted sample', async () => {
    await render(<LiturgyText text="text <tag>" selectable={false} tone="muted" />, { wrapper })
    expect(screen.getByText('text <tag>').props.selectable).toBe(false)
  })
  it('labels the input, forwards keyboard behavior and reports feedback', async () => {
    const change = jest.fn()
    const submit = jest.fn()
    await render(<TextField label="Email" keyboardType="email-address" error="Enter an address" onChangeText={change} onSubmitEditing={submit} />, { wrapper })
    const input = screen.getByLabelText('Email')
    await fireEvent.changeText(input, 'reader@example.org')
    await fireEvent(input, 'submitEditing')
    expect(change).toHaveBeenCalledWith('reader@example.org')
    expect(submit).toHaveBeenCalledTimes(1)
    expect(input.props.keyboardType).toBe('email-address')
    expect(input.props.allowFontScaling).toBe(true)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an address')
  })
  it('dismisses through close, backdrop, and the native back request', async () => {
    const dismiss = jest.fn()
    await render(<AppModal visible title="Reading" onDismiss={dismiss}><LiturgyText text={prayer.en} /></AppModal>, { wrapper })
    await fireEvent.press(screen.getByRole('button', { name: 'Close Reading' }))
    await fireEvent.press(screen.getByTestId('modal-backdrop', { includeHiddenElements: true }))
    await fireEvent(screen.getByTestId('app-modal'), 'requestClose')
    expect(dismiss).toHaveBeenCalledTimes(3)
  })
  it('hides the dismissed sheet', async () => {
    await render(<AppModal visible={false} title="Hidden reading" onDismiss={() => {}} />, { wrapper })
    expect(screen.queryByText('Hidden reading')).toBeNull()
  })
})

it('keeps every semantic text/background pairing at WCAG AA contrast', () => {
  function luminance(hex: string) {
    const channels = hex.slice(1).match(/../g)!.map(value => {
      const s = parseInt(value, 16) / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  for (const palette of Object.values(colors)) {
    for (const [text, background] of [
      [palette.foreground, palette.background], [palette.foreground, palette.surface],
      [palette.muted, palette.background], [palette.muted, palette.surface],
      [palette.primary, palette.surface], [palette.destructive, palette.surface],
      [palette.onPrimary, palette.primary], [palette.onSecondary, palette.secondary],
      [palette.onDestructive, palette.destructive],
    ]) {
      const values = [luminance(text), luminance(background)].sort((a, b) => b - a)
      expect((values[0] + 0.05) / (values[1] + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
  }
})
