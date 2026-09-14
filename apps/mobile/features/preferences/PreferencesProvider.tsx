import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { KeyValueAdapter, Language } from '@tarkman/core'
import { readingSizes, type ReadingSize } from '../../design/tokens'
import { preferencesStore } from './storage'

export const PREFERENCES_KEY = 'tarkman.preferences.v1'
export const DEFAULT_LANGUAGE: Language = 'en'
export const LANGUAGES: readonly Language[] = ['en', 'ru', 'grabar', 'translit']
/** Spoken language names, pronounceable without an Armenian or Russian voice, for labels beside text in its own script. */
export const SPOKEN_LANGUAGE: Record<Language, string> = { en: 'English', ru: 'Russian', grabar: 'Classical Armenian', translit: 'Transliteration' }
export type AppearancePreference = 'system' | 'light' | 'dark'
/** The most languages that fit side by side on a wide screen, for reading and for service control alike. */
export const MAX_LANGUAGES = 3
export const MAX_CONTROL_LANGUAGES = MAX_LANGUAGES
/** When a set must shrink to MAX_LANGUAGES, the active language stays, then these in turn. */
const KEEP_FIRST: readonly Language[] = ['grabar', 'en', 'translit', 'ru']
const APPEARANCES: readonly AppearancePreference[] = ['system', 'light', 'dark']

export interface Preferences {
  /** The language shown in compact reading layouts. */
  language: Language
  /** Languages available to the reader (1 to MAX_LANGUAGES), always kept in stable product order. */
  selectedLanguages: Language[]
  appearance: AppearancePreference
  readingSize: ReadingSize
  /**
   * The operator's own languages for service control, in the order they read them (1 to 3). Absent until they choose,
   * so control follows the reading language, with Grabar next. Kept apart so arranging control never changes the reading screen.
   */
  controlLanguages?: Language[]
}

const DEFAULT_PREFERENCES: Preferences = {
  language: DEFAULT_LANGUAGE,
  selectedLanguages: capLanguages(LANGUAGES, DEFAULT_LANGUAGE),
  appearance: 'system',
  readingSize: 'standard',
}

export interface PreferencesContextValue {
  /** False until stored preferences have loaded; screens may render with defaults meanwhile. */
  ready: boolean
  preferences: Preferences
  setLanguage(language: Language): void
  setSelectedLanguages(languages: readonly Language[]): void
  setAppearance(appearance: AppearancePreference): void
  setReadingSize(size: ReadingSize): void
  /** Sets service control's languages in order; duplicates, unknown values and anything past the limit are dropped. */
  setControlLanguages(languages: readonly Language[]): void
  /** Resets reading choices while preserving the reader's appearance. */
  clear(): void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ store = preferencesStore, children }: { store?: KeyValueAdapter; children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [ready, setReady] = useState(false)
  // Hydration may finish after the reader has already made a choice. A local
  // choice always wins over that late startup result.
  const localRevision = useRef(0)
  // Writes run one at a time so a clear cannot overwrite a newer choice.
  const writes = useRef<Promise<void>>(Promise.resolve())
  const persist = useCallback((write: () => Promise<void>) => {
    writes.current = writes.current.then(write).catch(() => { /* The choice still applies to this run of the app. */ })
  }, [])

  useEffect(() => {
    let active = true
    const hydrationRevision = localRevision.current
    store.get(PREFERENCES_KEY).then(raw => {
      if (!active) return
      const stored = readPreferences(raw)
      if (stored && localRevision.current === hydrationRevision) {
        setPreferences(stored.preferences)
        if (stored.migrated) persist(() => store.set(PREFERENCES_KEY, JSON.stringify(stored.preferences)))
      }
      // An unreadable or outdated record is replaced by defaults rather than blocking reading.
      else if (!stored && raw !== null && localRevision.current === hydrationRevision) persist(() => store.remove(PREFERENCES_KEY))
      setReady(true)
    }, () => { if (active) setReady(true) })
    return () => { active = false }
  }, [store, persist])

  const setLanguage = useCallback((language: Language) => {
    if (!LANGUAGES.includes(language)) return
    localRevision.current += 1
    setPreferences(current => {
      if (!current.selectedLanguages.includes(language)) return current
      const next = { ...current, language }
      persist(() => store.set(PREFERENCES_KEY, JSON.stringify(next)))
      return next
    })
  }, [store, persist])

  const setSelectedLanguages = useCallback((languages: readonly Language[]) => {
    const chosen = LANGUAGES.filter(language => languages.includes(language))
    if (chosen.length === 0) return
    localRevision.current += 1
    setPreferences(current => {
      const selectedLanguages = capLanguages(chosen, current.language)
      const language = selectedLanguages.includes(current.language) ? current.language : selectedLanguages[0]
      const next = { ...current, language, selectedLanguages }
      persist(() => store.set(PREFERENCES_KEY, JSON.stringify(next)))
      return next
    })
  }, [store, persist])

  const setAppearance = useCallback((appearance: AppearancePreference) => {
    if (!APPEARANCES.includes(appearance)) return
    localRevision.current += 1
    setPreferences(current => {
      const next = { ...current, appearance }
      persist(() => store.set(PREFERENCES_KEY, JSON.stringify(next)))
      return next
    })
  }, [store, persist])

  const setReadingSize = useCallback((readingSize: ReadingSize) => {
    if (!Object.hasOwn(readingSizes, readingSize)) return
    localRevision.current += 1
    setPreferences(current => {
      const next = { ...current, readingSize }
      persist(() => store.set(PREFERENCES_KEY, JSON.stringify(next)))
      return next
    })
  }, [store, persist])

  const setControlLanguages = useCallback((languages: readonly Language[]) => {
    const controlLanguages = normalizeControlLanguages(languages)
    if (!controlLanguages) return
    localRevision.current += 1
    setPreferences(current => {
      const next = { ...current, controlLanguages }
      persist(() => store.set(PREFERENCES_KEY, JSON.stringify(next)))
      return next
    })
  }, [store, persist])

  const clear = useCallback(() => {
    localRevision.current += 1
    setPreferences(current => {
      const next = { ...DEFAULT_PREFERENCES, appearance: current.appearance }
      persist(() => current.appearance === 'system'
        ? store.remove(PREFERENCES_KEY)
        : store.set(PREFERENCES_KEY, JSON.stringify(next)))
      return next
    })
  }, [store, persist])

  const value = useMemo(() => ({ ready, preferences, setLanguage, setSelectedLanguages, setAppearance, setReadingSize, setControlLanguages, clear }),
    [ready, preferences, setLanguage, setSelectedLanguages, setAppearance, setReadingSize, setControlLanguages, clear])
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences must be used within a PreferencesProvider')
  return context
}

function readPreferences(raw: string | null): { preferences: Preferences; migrated: boolean } | null {
  if (!raw) return null
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    const record = data as { language?: unknown; selectedLanguages?: unknown; appearance?: unknown; readingSize?: unknown; controlLanguages?: unknown }
    if (typeof record.language !== 'string' || !LANGUAGES.includes(record.language as Language)) return null
    const language = record.language as Language
    const storedLanguages = Array.isArray(record.selectedLanguages) ? record.selectedLanguages : null
    // More than MAX_LANGUAGES could never be shown side by side; shrink the set, keeping the reading language.
    const selectedLanguages = capLanguages(storedLanguages
      ? LANGUAGES.filter(item => storedLanguages.includes(item))
      : [...LANGUAGES], language)
    if (selectedLanguages.length === 0) return null
    const validAppearance = typeof record.appearance === 'string' && APPEARANCES.includes(record.appearance as AppearancePreference)
    const appearance = validAppearance ? record.appearance as AppearancePreference : 'system'
    const validReadingSize = typeof record.readingSize === 'string' && Object.hasOwn(readingSizes, record.readingSize)
    const readingSize = validReadingSize ? record.readingSize as ReadingSize : 'standard'
    // An unreadable control arrangement is dropped on its own; it never discards the reader's other choices.
    const controlLanguages = Array.isArray(record.controlLanguages) ? normalizeControlLanguages(record.controlLanguages) : null
    const controlChanged = record.controlLanguages !== undefined && (!controlLanguages
      || JSON.stringify(controlLanguages) !== JSON.stringify(record.controlLanguages))
    const normalizedSelection = storedLanguages !== null && storedLanguages.length === selectedLanguages.length
      && storedLanguages.every((item, index) => item === selectedLanguages[index])
    return {
      preferences: {
        language: selectedLanguages.includes(language) ? language : selectedLanguages[0],
        selectedLanguages,
        appearance,
        readingSize,
        ...(controlLanguages ? { controlLanguages } : {}),
      },
      migrated: !validReadingSize || !normalizedSelection || !validAppearance || !selectedLanguages.includes(language) || controlChanged,
    }
  } catch {
    return null
  }
}

/** Known languages in the given order, each once, at most MAX_CONTROL_LANGUAGES; null when none remain. */
function normalizeControlLanguages(languages: readonly unknown[]): Language[] | null {
  const ordered = languages.filter((item, index): item is Language => LANGUAGES.includes(item as Language) && languages.indexOf(item) === index)
    .slice(0, MAX_CONTROL_LANGUAGES)
  return ordered.length > 0 ? ordered : null
}

/** Service control's languages in order: the operator's arrangement, or by default the reading language beside Grabar (or beside the next chosen language). */
export function resolveControlLanguages(preferences: Preferences): Language[] {
  if (preferences.controlLanguages?.length) return preferences.controlLanguages
  const others = preferences.selectedLanguages.filter(item => item !== preferences.language)
  const grabarNext = others.includes('grabar') ? ['grabar' as const, ...others.filter(item => item !== 'grabar')] : others
  return [preferences.language, ...grabarNext].slice(0, 2)
}

/** At most MAX_LANGUAGES in product order, keeping `active` and then KEEP_FIRST when some must go. */
function capLanguages(languages: readonly Language[], active: Language): Language[] {
  if (languages.length <= MAX_LANGUAGES) return [...languages]
  const kept = [active, ...KEEP_FIRST.filter(item => item !== active)].filter(item => languages.includes(item)).slice(0, MAX_LANGUAGES)
  return LANGUAGES.filter(item => kept.includes(item))
}
