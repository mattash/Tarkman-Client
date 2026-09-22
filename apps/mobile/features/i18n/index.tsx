import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLocales } from 'expo-localization'
import { en } from './catalogs/en'
import { ru } from './catalogs/ru'
import { formatMessage, lookupMessage, type CatalogShape, type MessageParams, type MessagePath } from './messages'

export type Catalog = CatalogShape<typeof en>
export type MessageKey = MessagePath<typeof en>

/**
 * Interface languages the app can show. `reviewed` is false while a translation still awaits a fluent reader's check;
 * an unreviewed catalog is offered only in development and preview builds.
 */
export const INTERFACE_CATALOGS = {
  en: { catalog: en as Catalog, nativeName: 'English', reviewed: true },
  ru: { catalog: ru, nativeName: 'Русский', reviewed: true },
} satisfies Record<string, { catalog: Catalog; nativeName: string; reviewed: boolean }>

export type InterfaceLanguage = keyof typeof INTERFACE_CATALOGS
export type InterfaceLanguagePreference = 'system' | InterfaceLanguage
export const DEFAULT_INTERFACE_LANGUAGE: InterfaceLanguage = 'en'

export function isInterfaceLanguage(value: unknown): value is InterfaceLanguage {
  return typeof value === 'string' && Object.hasOwn(INTERFACE_CATALOGS, value)
}

/** Development and preview builds offer draft translations so testers can check them; production builds never do. */
export function includesDraftLanguages(isDevelopment = __DEV__, environment = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT): boolean {
  return isDevelopment || environment === 'preview'
}

/** Languages a reader may choose: reviewed ones always, unreviewed drafts only where testers can check them. */
export function availableInterfaceLanguages(includeDrafts: boolean): InterfaceLanguage[] {
  return (Object.keys(INTERFACE_CATALOGS) as InterfaceLanguage[])
    .filter(language => includeDrafts || INTERFACE_CATALOGS[language].reviewed)
}

/** An explicit choice wins; otherwise the first device language the app has, then English. */
export function resolveInterfaceLanguage(preference: InterfaceLanguagePreference | undefined, deviceLanguages: readonly (string | null | undefined)[],
  available: readonly InterfaceLanguage[]): InterfaceLanguage {
  if (preference && preference !== 'system' && available.includes(preference)) return preference
  for (const code of deviceLanguages) {
    const base = code?.toLowerCase().split(/[-_]/)[0]
    if (base && (available as readonly string[]).includes(base)) return base as InterfaceLanguage
  }
  return DEFAULT_INTERFACE_LANGUAGE
}

// Code outside React (API errors, parsed fallbacks) reads the language the provider last resolved.
let activeLanguage: InterfaceLanguage = DEFAULT_INTERFACE_LANGUAGE

export function setActiveInterfaceLanguage(language: InterfaceLanguage) { activeLanguage = language }
export function activeInterfaceLanguage(): InterfaceLanguage { return activeLanguage }

/** Missing or empty messages fall back to English, so an incomplete translation never shows a key. */
export function translate(language: InterfaceLanguage, key: MessageKey, params?: MessageParams): string {
  const message = lookupMessage(INTERFACE_CATALOGS[language]?.catalog, key) ?? lookupMessage(en, key)
  return message === undefined ? key : formatMessage(language, message, params)
}

export function t(key: MessageKey, params?: MessageParams): string {
  return translate(activeLanguage, key, params)
}

/**
 * The locale for dates and numbers. English keeps the device's regional format (a British reader still sees day-first dates);
 * another interface language formats dates in that language.
 */
export function formatLocale(language: InterfaceLanguage = activeLanguage): string | undefined {
  return language === DEFAULT_INTERFACE_LANGUAGE ? undefined : language
}

/** Known session statuses by name; anything newer from the server is shown as sent, with underscores as spaces. */
export function statusName(status: string, language: InterfaceLanguage = activeLanguage): string {
  const key = `statuses.${status}` as MessageKey
  if (Object.hasOwn(en.statuses, status)) return translate(language, key)
  const words = status.replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

interface I18nValue { language: InterfaceLanguage; t(key: MessageKey, params?: MessageParams): string }

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ preference, includeDrafts = includesDraftLanguages(), children }: { preference?: InterfaceLanguagePreference; includeDrafts?: boolean; children: ReactNode }) {
  const locales = useLocales()
  const deviceLanguages = locales.map(locale => locale.languageCode)
  const language = resolveInterfaceLanguage(preference, deviceLanguages, availableInterfaceLanguages(includeDrafts))
  setActiveInterfaceLanguage(language)
  const value = useMemo<I18nValue>(() => ({ language, t: (key, params) => translate(language, key, params) }), [language])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Screens rendered without the provider (tests, isolated previews) read the active language, English by default. */
export function useI18n(): I18nValue {
  const context = useContext(I18nContext)
  return context ?? { language: activeLanguage, t }
}
