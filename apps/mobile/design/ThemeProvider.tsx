import { createContext, useContext, useEffect, type PropsWithChildren } from 'react'
import { Appearance, Platform, useColorScheme } from 'react-native'
import { colors, type ThemeName } from './tokens'
import type { AppearancePreference } from '../features/preferences/PreferencesProvider'

const ThemeContext = createContext<ThemeName | null>(null)
// Explicit scheme also supports isolated samples without changing OS preferences.
/**
 * iOS draws some chrome itself (the native tab bar, alerts, the keyboard), and it follows the system unless
 * told otherwise. Forward the in-app choice so it cannot disagree with the JS surfaces; `unspecified` gives
 * control back to the system. Only the app's own provider does this, never an explicit-scheme sample.
 */
function useNativeAppearance(appearance: AppearancePreference | undefined) {
  useEffect(() => {
    if (Platform.OS !== 'ios' || appearance === undefined) return
    Appearance.setColorScheme(appearance === 'system' ? 'unspecified' : appearance)
  }, [appearance])
}
export function ThemeProvider({ children, scheme, appearance = 'system' }: PropsWithChildren<{ scheme?: ThemeName; appearance?: AppearancePreference }>) {
  const system = useColorScheme()
  useNativeAppearance(scheme === undefined ? appearance : undefined)
  const resolved = scheme ?? (appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance)
  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>
}
export function useTheme() {
  const scheme = useContext(ThemeContext)
  if (!scheme) throw new Error('Use primitives inside ThemeProvider')
  return { scheme, colors: colors[scheme] }
}
