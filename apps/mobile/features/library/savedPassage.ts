import type { Language } from '@tarkman/core'
import type { Bundle } from './contracts'
import { resolveTextJump, type TextJumpTarget } from './textFind'

/** Wire bundles have six languages; the personal reader only supports these four. */
export function canOpenSavedPassage(bundle: Bundle, target: TextJumpTarget): target is TextJumpTarget & { language: Language } {
  return ['en', 'ru', 'grabar', 'translit'].includes(target.language) && resolveTextJump(bundle, target) !== null
}
