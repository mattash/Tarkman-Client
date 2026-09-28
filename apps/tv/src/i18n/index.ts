import { createContext, createElement, useContext, useMemo, useState, type ReactNode } from 'react'
import { getLocales } from 'expo-localization'
import type { ReaderMessageKey } from '@tarkman/reader'
import { en, type Catalog } from './en'
import { ru } from './ru'

export const INTERFACE_LANGUAGES = ['en', 'ru'] as const
export type InterfaceLanguage = typeof INTERFACE_LANGUAGES[number]
const catalogs: Record<InterfaceLanguage, Catalog> = { en, ru }

type Paths<T, Prefix extends string = ''> = { [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`> }[keyof T & string]
export type MessageKey = Paths<Catalog>
export type Params = Record<string, string | number>

export function deviceInterfaceLanguage(): InterfaceLanguage {
  try { return getLocales()[0]?.languageCode === 'ru' ? 'ru' : 'en' } catch { return 'en' }
}

// Module-level so the reader engine's text adapter, which runs outside React, uses the chosen language.
let active: InterfaceLanguage = deviceInterfaceLanguage()

export function translate(language: InterfaceLanguage, key: MessageKey, params?: Params): string {
  const lookup = (catalog: Catalog) => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalog)
  const message = lookup(catalogs[language]) ?? lookup(en)
  const text = typeof message === 'string' ? message : key
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => name in params ? String(params[name]) : match) : text
}
export function t(key: MessageKey, params?: Params): string { return translate(active, key, params) }

/** Every engine message key is a catalog key; this fails to compile if the engine adds one. */
const engineKey: (key: ReaderMessageKey) => MessageKey = key => key
export const readerText = (key: ReaderMessageKey): string => t(engineKey(key))

interface I18n { language: InterfaceLanguage; setLanguage(language: InterfaceLanguage): void; t: typeof t }
const I18nContext = createContext<I18n>({ language: active, setLanguage: () => {}, t })

export function I18nProvider({ children, initial = active }: { children: ReactNode; initial?: InterfaceLanguage }) {
  const [language, setState] = useState<InterfaceLanguage>(() => { active = initial; return initial })
  const value = useMemo<I18n>(() => ({
    language,
    setLanguage: next => { active = next; setState(next) },
    t: (key, params) => translate(language, key, params),
  }), [language])
  return createElement(I18nContext.Provider, { value }, children)
}
export function useI18n(): I18n { return useContext(I18nContext) }
