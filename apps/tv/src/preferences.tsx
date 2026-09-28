import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Language } from '@tarkman/core'
import { deviceInterfaceLanguage } from './i18n'
import type { TextSize } from './theme'

// Viewer choices for this session. Persisting them, and any saved church, belongs to #215.
export interface Preferences {
  readingLanguage: Language; textSize: TextSize
  setReadingLanguage(language: Language): void; setTextSize(size: TextSize): void
}
const PreferencesContext = createContext<Preferences | null>(null)

export function PreferencesProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage?: Language }) {
  const [readingLanguage, setReadingLanguage] = useState<Language>(() => initialLanguage ?? (deviceInterfaceLanguage() === 'ru' ? 'ru' : 'en'))
  const [textSize, setTextSize] = useState<TextSize>('medium')
  const value = useMemo(() => ({ readingLanguage, textSize, setReadingLanguage, setTextSize }), [readingLanguage, textSize])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
export function usePreferences(): Preferences {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences outside PreferencesProvider') // i18n-ignore: developer error
  return value
}
