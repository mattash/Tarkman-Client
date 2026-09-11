import type { Part } from './part.js'

export type Language = 'en' | 'ru' | 'grabar' | 'translit'
export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'grabar', label: 'Գրաբար' },
  { value: 'translit', label: 'Translit' },
] as const

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some(language => language.value === value)
}

/** Preserve nullable translations; fallback selection belongs to the caller. */
export function getPartText(part: Pick<Part, Language>, language: Language): string | null {
  return part[language]
}
