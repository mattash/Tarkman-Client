import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { I18nManager, Platform, useWindowDimensions } from 'react-native'
import { SegmentedControl } from '../components/SegmentedControl'
import { ThemeProvider } from '../design/ThemeProvider'
import type { AppButtonProps } from '../components/AppButton'

// The native test renderer has no browser host focus(). Keep the real button,
// substituting only its imperative host handle so focus destinations are observable.
const mockFocus = jest.fn<(label: string | undefined) => void>()
jest.mock('../components/AppButton', () => {
  const React = jest.requireActual('react') as typeof import('react')
  const { AppButton } = jest.requireActual('../components/AppButton') as typeof import('../components/AppButton')
  return { AppButton: ({ ref, ...props }: AppButtonProps) => {
    React.useImperativeHandle(ref, () => ({ focus: () => mockFocus(props.accessibilityLabel) }) as React.ComponentRef<typeof import('react-native').View>)
    return <AppButton {...props} />
  } }
})
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: jest.fn() }))

const originalPlatform = Platform.OS
const originalRTL = I18nManager.isRTL
const dimensions = jest.mocked(useWindowDimensions)
const options = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }]
const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider scheme="light">{children}</ThemeProvider>
const radio = (label: string) => screen.getByRole('radio', { name: `Mode, ${label}` })
const tabs = () => screen.getAllByRole('radio').map(button => button.props.tabIndex)
async function key(label: string, name: string, modifiers = {}) {
  const event = { key: name, preventDefault: jest.fn(), ...modifiers }
  await fireEvent(radio(label), 'keyDown', event)
  return event
}
beforeEach(() => {
  Platform.OS = 'web'
  I18nManager.isRTL = false
  dimensions.mockReturnValue({ width: 800, height: 600, scale: 1, fontScale: 1 })
  mockFocus.mockClear()
})
afterEach(() => { Platform.OS = originalPlatform; I18nManager.isRTL = originalRTL })

describe('SegmentedControl', () => {
  it.each(['ios', 'android'] as const)('preserves the %s touch and accessibility contract without web props', async platform => {
    Platform.OS = platform
    const onChange = jest.fn()
    const view = await render(<SegmentedControl label="Mode" value="b" options={options} onChange={onChange} />, { wrapper })
    expect(screen.getByLabelText('Mode')).toHaveProp('accessibilityRole', 'radiogroup')
    expect(radio('Beta').props.accessibilityState).toMatchObject({ selected: true, checked: true })
    expect(radio('Alpha').props.accessibilityState).toMatchObject({ selected: false, checked: false })
    for (const button of screen.getAllByRole('radio')) {
      expect(button.props.tabIndex).toBeUndefined()
      expect(button.props.onKeyDown).toBeUndefined()
    }
    await fireEvent.press(radio('Gamma'))
    expect(onChange).toHaveBeenLastCalledWith('c')
    await view.rerender(<SegmentedControl label="Mode" value="b" options={options} onChange={onChange} disabled />)
    await fireEvent.press(radio('Alpha'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(radio('Alpha')).toBeDisabled()
  })

  it('moves selection and host focus, with one tab stop following controlled rerenders', async () => {
    const onChange = jest.fn()
    const view = await render(<SegmentedControl label="Mode" value="b" options={options} onChange={onChange} />, { wrapper })
    expect(tabs()).toEqual([-1, 0, -1])
    expect((await key('Beta', 'ArrowRight')).preventDefault).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith('c')
    expect(mockFocus).toHaveBeenLastCalledWith('Mode, Gamma')
    // Selection remains controlled until the owner supplies the new value.
    expect(tabs()).toEqual([-1, 0, -1])
    await view.rerender(<SegmentedControl label="Mode" value="c" options={options} onChange={onChange} />)
    expect(tabs()).toEqual([-1, -1, 0])
    expect(radio('Gamma').props.accessibilityState).toMatchObject({ checked: true, selected: true })
    await key('Gamma', 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith('a')
    expect(mockFocus).toHaveBeenLastCalledWith('Mode, Alpha')
    await view.rerender(<SegmentedControl label="Mode" value="a" options={options} onChange={onChange} />)
    await key('Alpha', 'ArrowLeft')
    expect(onChange).toHaveBeenLastCalledWith('c')
    expect(mockFocus).toHaveBeenLastCalledWith('Mode, Gamma')
  })

  it('supports Home/End while leaving Tab, activation, unrelated and modified keys alone', async () => {
    const onChange = jest.fn()
    await render(<SegmentedControl label="Mode" value="b" options={options} onChange={onChange} />, { wrapper })
    await key('Beta', 'Home')
    expect(onChange).toHaveBeenLastCalledWith('a')
    expect(mockFocus).toHaveBeenLastCalledWith('Mode, Alpha')
    await key('Beta', 'End')
    expect(onChange).toHaveBeenLastCalledWith('c')
    expect(mockFocus).toHaveBeenLastCalledWith('Mode, Gamma')
    for (const name of ['Tab', 'Enter', ' ', 'Escape', 'ArrowUp']) {
      expect((await key('Beta', name)).preventDefault).not.toHaveBeenCalled()
    }
    expect((await key('Beta', 'ArrowRight', { ctrlKey: true })).preventDefault).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(mockFocus).toHaveBeenCalledTimes(2)
    await fireEvent.press(radio('Alpha'))
    expect(onChange).toHaveBeenLastCalledWith('a')
  })

  it.each([{ width: 320, fontScale: 1 }, { width: 800, fontScale: 1.4 }])('uses vertical arrows when stacked: %j', async metrics => {
    dimensions.mockReturnValue({ ...metrics, height: 600, scale: 1 })
    const onChange = jest.fn()
    await render(<SegmentedControl label="Mode" value="a" options={options} onChange={onChange} />, { wrapper })
    expect(screen.getByLabelText('Mode').props['aria-orientation']).toBe('vertical')
    await key('Alpha', 'ArrowUp')
    expect(onChange).toHaveBeenLastCalledWith('c')
    expect(mockFocus).toHaveBeenLastCalledWith('Mode, Gamma')
    await key('Alpha', 'ArrowDown')
    expect(onChange).toHaveBeenLastCalledWith('b')
    expect((await key('Alpha', 'ArrowRight')).preventDefault).not.toHaveBeenCalled()
  })

  it('reverses horizontal arrows in RTL', async () => {
    I18nManager.isRTL = true
    const onChange = jest.fn()
    await render(<SegmentedControl label="Mode" value="a" options={options} onChange={onChange} />, { wrapper })
    await key('Alpha', 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith('c')
    await key('Alpha', 'ArrowLeft')
    expect(onChange).toHaveBeenLastCalledWith('b')
    expect(mockFocus).toHaveBeenLastCalledWith('Mode, Beta')
  })

  it('removes disabled tab stops and suppresses keyboard, focus and press actions', async () => {
    const onChange = jest.fn()
    await render(<SegmentedControl label="Mode" value="b" options={options} onChange={onChange} disabled />, { wrapper })
    expect(tabs()).toEqual([-1, -1, -1])
    await key('Beta', 'ArrowRight')
    await key('Beta', 'Home')
    await fireEvent.press(radio('Alpha'))
    expect(onChange).not.toHaveBeenCalled()
    expect(mockFocus).not.toHaveBeenCalled()
  })

  it('falls back to the first tab stop for an absent value, and handles empty/single options', async () => {
    const onChange = jest.fn()
    const view = await render(<SegmentedControl label="Mode" value="missing" options={options} onChange={onChange} />, { wrapper })
    expect(tabs()).toEqual([0, -1, -1])
    expect(screen.getAllByRole('radio').every(button => !button.props.accessibilityState.checked)).toBe(true)
    await key('Alpha', 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith('b')
    await view.rerender(<SegmentedControl label="Mode" value="a" options={options.slice(0, 1)} onChange={onChange} />)
    onChange.mockClear()
    await key('Alpha', 'ArrowRight')
    expect(mockFocus).toHaveBeenLastCalledWith('Mode, Alpha')
    expect(onChange).not.toHaveBeenCalled()
    expect(tabs()).toEqual([0])
    await view.rerender(<SegmentedControl label="Mode" value="a" options={[]} onChange={onChange} />)
    expect(screen.queryAllByRole('radio')).toEqual([])
  })
})
