import { Part } from '../types/part'

export type PartTextField = 'translit' | 'en' | 'hy_west' | 'grabar'

export function getPartTextField(part: Part, field: PartTextField): string {
  return part[field] ?? ''
}

export const HIDDEN_SENTINELS = new Set(['HOLD', 'NA', 'EMPTY'])

export function shouldHideSessionPartText(text: string): boolean {
  const normalized = text.trim().toUpperCase()
  return normalized.length === 0 || HIDDEN_SENTINELS.has(normalized)
}
