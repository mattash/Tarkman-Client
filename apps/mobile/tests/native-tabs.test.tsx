import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { Appearance, Platform } from 'react-native'
import { render } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { NATIVE_TABS_MIN_IOS, nativeTabsSupported, TAB_SYMBOLS } from '../components/tabSymbols'
import type { TabItem } from '../components/TabBar'

afterEach(() => { jest.restoreAllMocks() })

describe('native tab bar gating', () => {
  it('turns on at iOS 26 and stays off before it, however the version is spelled', () => {
    expect(NATIVE_TABS_MIN_IOS).toBe(26)
    for (const version of ['26', '26.0', '26.5', '27.0', 26, 27]) expect(nativeTabsSupported(version)).toBe(true)
    for (const version of ['16.4', '17.7', '18.6', '25.9', 18, 25]) expect(nativeTabsSupported(version)).toBe(false)
  })
  it('never turns on for a version it cannot read', () => {
    for (const version of ['', 'beta', 'NaN']) expect(nativeTabsSupported(version)).toBe(false)
  })
  it('has an SF Symbol for every tab icon the JS bar has', () => {
    const icons: TabItem['icon'][] = ['tab-today', 'tab-services', 'tab-settings', 'tab-about']
    expect(Object.keys(TAB_SYMBOLS).sort()).toEqual([...icons].sort())
    for (const icon of icons) expect(TAB_SYMBOLS[icon]).toMatch(/^[a-z0-9.]+$/)
  })
})

describe('native appearance follows the in-app choice', () => {
  const setup = () => jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {})
  const original = Platform.OS
  afterEach(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: original }) })
  const onIos = () => Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })

  it('forces dark or light, and gives control back to the system for System', async () => {
    onIos(); const spy = setup()
    const view = await render(<ThemeProvider appearance="dark"><></></ThemeProvider>)
    expect(spy).toHaveBeenLastCalledWith('dark')
    await view.rerender(<ThemeProvider appearance="light"><></></ThemeProvider>)
    expect(spy).toHaveBeenLastCalledWith('light')
    await view.rerender(<ThemeProvider appearance="system"><></></ThemeProvider>)
    expect(spy).toHaveBeenLastCalledWith('unspecified')
  })
  it('leaves the system alone for an explicit-scheme sample and off iOS', async () => {
    onIos(); const spy = setup()
    await render(<ThemeProvider scheme="light"><></></ThemeProvider>)
    expect(spy).not.toHaveBeenCalled()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
    await render(<ThemeProvider appearance="dark"><></></ThemeProvider>)
    expect(spy).not.toHaveBeenCalled()
  })
})
