import { hasOwn } from '../shared/hasOwn'

/** Plural forms follow CLDR categories; English needs one and other, Russian also few and many. */
export interface PluralMessage { one: string; few?: string; many?: string; other: string }
export type Message = string | PluralMessage
export type MessageParams = Record<string, string | number>

/** A translation must have exactly the English catalog's shape, so a missing key fails type checking. */
export type CatalogShape<T> = { [K in keyof T]: T[K] extends string ? string : T[K] extends PluralMessage ? PluralMessage : CatalogShape<T[K]> }

/** Dot-separated paths to every message in a catalog, e.g. `settings.title`. */
export type MessagePath<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Message ? `${Prefix}${K}` : MessagePath<T[K], `${Prefix}${K}.`>
}[keyof T & string]

export function isPluralMessage(value: unknown): value is PluralMessage {
  return !!value && typeof value === 'object' && typeof (value as PluralMessage).one === 'string' && typeof (value as PluralMessage).other === 'string'
}

export function lookupMessage(catalog: unknown, path: string): Message | undefined {
  let node: unknown = catalog
  for (const segment of path.split('.')) {
    if (!node || typeof node !== 'object' || !hasOwn(node, segment)) return undefined
    node = (node as Record<string, unknown>)[segment]
  }
  if (typeof node === 'string') return node.length > 0 ? node : undefined
  return isPluralMessage(node) ? node : undefined
}

/** Integer plural rules for the interface languages, so wording never depends on the device's Intl support. */
export function pluralCategory(language: string, count: number): keyof PluralMessage {
  if (!Number.isInteger(count)) return 'other'
  const n = Math.abs(count)
  if (language === 'ru') {
    const tens = n % 100
    if (n % 10 === 1 && tens !== 11) return 'one'
    if (n % 10 >= 2 && n % 10 <= 4 && (tens < 12 || tens > 14)) return 'few'
    return 'many'
  }
  return n === 1 ? 'one' : 'other'
}

export function formatMessage(language: string, message: Message, params?: MessageParams): string {
  const count = params?.count
  const text = typeof message === 'string' ? message
    : message[typeof count === 'number' ? pluralCategory(language, count) : 'other'] ?? message.other
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => params && hasOwn(params, name) ? String(params[name]) : placeholder)
}

/** Every `{name}` placeholder in a message, across all plural forms. */
export function placeholders(message: Message): string[] {
  const texts = typeof message === 'string' ? [message] : Object.values(message).filter((value): value is string => typeof value === 'string')
  return [...new Set(texts.flatMap(text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1])))].sort()
}
