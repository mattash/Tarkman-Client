import * as React from 'react'

export type ReadingAppearance = 'system' | 'light' | 'dark'
export type ResolvedReadingAppearance = Exclude<ReadingAppearance, 'system'>

export const READING_APPEARANCE_STORAGE_KEY = 'tarkman.reader.appearance.v1'

interface StorageReader {
  getItem: (key: string) => string | null
}

interface StorageWriter {
  setItem: (key: string, value: string) => void
}

function isReadingAppearance(value: string | null): value is ReadingAppearance {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function loadReadingAppearance(storage: StorageReader | null): ReadingAppearance {
  if (!storage) return 'system'

  try {
    const storedValue = storage.getItem(READING_APPEARANCE_STORAGE_KEY)
    return isReadingAppearance(storedValue) ? storedValue : 'system'
  } catch {
    return 'system'
  }
}

export function saveReadingAppearance(
  storage: StorageWriter | null,
  appearance: ReadingAppearance,
): boolean {
  if (!storage) return false

  try {
    storage.setItem(READING_APPEARANCE_STORAGE_KEY, appearance)
    return true
  } catch {
    return false
  }
}

export function resolveReadingAppearance(
  appearance: ReadingAppearance,
  systemPrefersDark: boolean,
): ResolvedReadingAppearance {
  if (appearance === 'system') return systemPrefersDark ? 'dark' : 'light'
  return appearance
}

export function getReadingAppearanceStorage(
  scope: { readonly localStorage: Storage } | undefined,
): Storage | null {
  try {
    return scope?.localStorage ?? null
  } catch {
    return null
  }
}

function getSystemColorScheme(): MediaQueryList | null {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? null
    : window.matchMedia('(prefers-color-scheme: dark)')
}

export function useReadingAppearance() {
  const [appearance, setAppearanceState] = React.useState<ReadingAppearance>(() =>
    loadReadingAppearance(getReadingAppearanceStorage(typeof window === 'undefined' ? undefined : window)),
  )
  const [systemPrefersDark, setSystemPrefersDark] = React.useState(
    () => getSystemColorScheme()?.matches ?? false,
  )

  React.useEffect(() => {
    if (appearance !== 'system') return

    const mediaQuery = getSystemColorScheme()
    if (!mediaQuery) return

    const handleChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    setSystemPrefersDark(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [appearance])

  const resolvedAppearance = resolveReadingAppearance(appearance, systemPrefersDark)

  React.useEffect(() => {
    document.documentElement.dataset.tarkmanReadingTheme = resolvedAppearance
    return () => {
      delete document.documentElement.dataset.tarkmanReadingTheme
    }
  }, [resolvedAppearance])

  const setAppearance = React.useCallback((nextAppearance: ReadingAppearance) => {
    setAppearanceState(nextAppearance)
    saveReadingAppearance(
      getReadingAppearanceStorage(typeof window === 'undefined' ? undefined : window),
      nextAppearance,
    )
  }, [])

  return { appearance, resolvedAppearance, setAppearance }
}
