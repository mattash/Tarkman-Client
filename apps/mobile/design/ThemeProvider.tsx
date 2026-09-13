import { createContext, useContext, type PropsWithChildren } from 'react'
import { useColorScheme } from 'react-native'
import { colors, type ThemeName } from './tokens'
import type { AppearancePreference } from '../features/preferences/PreferencesProvider'

const ThemeContext = createContext<ThemeName | null>(null)
// Explicit scheme also supports isolated samples without changing OS preferences.
export function ThemeProvider({ children, scheme, appearance = 'system' }: PropsWithChildren<{ scheme?: ThemeName; appearance?: AppearancePreference }>) {
  const system = useColorScheme()
  const resolved = scheme ?? (appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance)
  return <ThemeContext.Provider value={resolved}>{children}</ThemeContext.Provider>
}
export function useTheme() {
  const scheme = useContext(ThemeContext)
  if (!scheme) throw new Error('Use primitives inside ThemeProvider')
  return { scheme, colors: colors[scheme] }
}
