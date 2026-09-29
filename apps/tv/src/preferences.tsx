import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_DISPLAY_CONFIG, type DisplayPreferences } from '@tarkman/reader'

/** Mobile's display defaults, sized for a television. */
export const TV_DISPLAY_DEFAULTS: DisplayPreferences = { ...DEFAULT_DISPLAY_CONFIG, device_type: 'tv' }

// Display choices for this session. Persisting them, and any saved church, belongs to #215.
export interface Preferences { display: DisplayPreferences; updateDisplay(patch: Partial<DisplayPreferences>): void }
const PreferencesContext = createContext<Preferences | null>(null)

export function PreferencesProvider({ children, initialDisplay = TV_DISPLAY_DEFAULTS }: { children: ReactNode; initialDisplay?: DisplayPreferences }) {
  const [display, setDisplay] = useState<DisplayPreferences>(initialDisplay)
  const value = useMemo<Preferences>(() => ({ display, updateDisplay: patch => setDisplay(current => ({ ...current, ...patch })) }), [display])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
export function usePreferences(): Preferences {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences outside PreferencesProvider') // i18n-ignore: developer error
  return value
}
