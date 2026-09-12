import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { KeyValueAdapter, Language } from '@tarkman/core'
import { preferencesStore } from './storage'

export const PREFERENCES_KEY = 'tarkman.preferences.v1'
export const DEFAULT_LANGUAGE: Language = 'en'
const LANGUAGES: Language[] = ['en', 'ru', 'grabar', 'translit']

export interface Preferences { language: Language }

export interface PreferencesContextValue {
  /** False until stored preferences have loaded; screens may render with defaults meanwhile. */
  ready: boolean
  preferences: Preferences
  setLanguage(language: Language): void
  /** Forgets everything kept on this device and returns to defaults. */
  clear(): void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ store = preferencesStore, children }: { store?: KeyValueAdapter; children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>({ language: DEFAULT_LANGUAGE })
  const [ready, setReady] = useState(false)
  // Writes run one at a time so a clear cannot overwrite a newer choice.
  const writes = useRef<Promise<void>>(Promise.resolve())
  const persist = useCallback((write: () => Promise<void>) => {
    writes.current = writes.current.then(write).catch(() => { /* The choice still applies to this run of the app. */ })
  }, [])

  useEffect(() => {
    let active = true
    store.get(PREFERENCES_KEY).then(raw => {
      if (!active) return
      const stored = readPreferences(raw)
      if (stored) setPreferences(stored)
      // An unreadable or outdated record is replaced by defaults rather than blocking reading.
      else if (raw !== null) persist(() => store.remove(PREFERENCES_KEY))
      setReady(true)
    }, () => { if (active) setReady(true) })
    return () => { active = false }
  }, [store, persist])

  const setLanguage = useCallback((language: Language) => {
    if (!LANGUAGES.includes(language)) return
    setPreferences(current => {
      const next = { ...current, language }
      persist(() => store.set(PREFERENCES_KEY, JSON.stringify(next)))
      return next
    })
  }, [store, persist])

  const clear = useCallback(() => {
    setPreferences({ language: DEFAULT_LANGUAGE })
    persist(() => store.remove(PREFERENCES_KEY))
  }, [store, persist])

  const value = useMemo(() => ({ ready, preferences, setLanguage, clear }), [ready, preferences, setLanguage, clear])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences must be used within a PreferencesProvider')
  return context
}

function readPreferences(raw: string | null): Preferences | null {
  if (!raw) return null
  try {
    const data: unknown = JSON.parse(raw)
    const language = (data as { language?: unknown }).language
    return typeof language === 'string' && LANGUAGES.includes(language as Language) ? { language: language as Language } : null
  } catch {
    return null
  }
}
