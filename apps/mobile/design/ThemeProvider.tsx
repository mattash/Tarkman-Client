import { createContext, useContext, type PropsWithChildren } from 'react'
import { useColorScheme } from 'react-native'
import { colors, type ThemeName } from './tokens'

const ThemeContext = createContext<ThemeName | null>(null)
// Explicit scheme also supports isolated samples without changing OS preferences.
export function ThemeProvider({ children, scheme }: PropsWithChildren<{ scheme?: ThemeName }>) {
  const system = useColorScheme()
  return <ThemeContext.Provider value={scheme ?? (system === 'dark' ? 'dark' : 'light')}>{children}</ThemeContext.Provider>
}
export function useTheme() {
  const scheme = useContext(ThemeContext)
  if (!scheme) throw new Error('Use primitives inside ThemeProvider')
  return { scheme, colors: colors[scheme] }
}
