import { afterEach, describe, expect, it } from '@jest/globals'
import { Platform, Text } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { colors } from '../design/tokens'
import { LIQUID_GLASS_MIN_IOS, liquidGlassSupported, useSheetBackground } from '../design/liquidGlass'

const original = { os: Platform.OS, version: Platform.Version }
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: original.os })
  Object.defineProperty(Platform, 'Version', { configurable: true, value: original.version })
})
const setPlatform = (os: string, version: string | number) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
  Object.defineProperty(Platform, 'Version', { configurable: true, value: version })
}

describe('liquid glass gate', () => {
  it('turns on at iOS 26 and stays off before it, however the version is spelled', () => {
    expect(LIQUID_GLASS_MIN_IOS).toBe(26)
    for (const version of ['26', '26.0', '26.5', '27.0', 26, 27]) expect(liquidGlassSupported(version, 'ios')).toBe(true)
    for (const version of ['16.4', '17.7', '18.6', '25.9', 18, 25]) expect(liquidGlassSupported(version, 'ios')).toBe(false)
  })
  it('never turns on for an unreadable version, or off iOS', () => {
    for (const version of ['', 'beta', 'NaN']) expect(liquidGlassSupported(version, 'ios')).toBe(false)
    for (const os of ['android', 'web']) expect(liquidGlassSupported('27.0', os)).toBe(false)
  })
})

describe('sheet background', () => {
  function Probe() {
    return <Text testID="bg">{useSheetBackground()}</Text>
  }
  const shown = async (scheme: 'light' | 'dark') => {
    await render(<ThemeProvider scheme={scheme}><Probe /></ThemeProvider>)
    return screen.getByTestId('bg').props.children
  }
  it('is transparent on iOS 26 so the system glass shows, and the app overlay color elsewhere', async () => {
    setPlatform('ios', '26.5')
    expect(await shown('light')).toBe('transparent')
  })
  it('keeps the overlay color on older iOS and on Android, in both themes', async () => {
    setPlatform('ios', '18.6')
    expect(await shown('light')).toBe(colors.light.overlay)
    setPlatform('android', 34)
    expect(await shown('dark')).toBe(colors.dark.overlay)
  })
})
