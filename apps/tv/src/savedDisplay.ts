import type { KeyValueAdapter } from '@tarkman/core'

/**
 * The church display this TV opens at launch. Only public identity is stored: the church, the chosen
 * display link and its public launch token. Never a session ID, which changes every service.
 */
export const SAVED_DISPLAY_KEY = 'tarkman.tv.saved-display.v1'

export interface SavedChurch { id: string; name: string; locality: string | null }
export interface SavedLink { id: string; title: string; token: string }
export interface SavedDisplayV1 { version: 1; savedAt: number; church: SavedChurch; link: SavedLink }

/**
 * `corrupt` cannot be parsed or fails validation; `newer` was written by a later app version. Neither is
 * deleted on read: the viewer chooses to set up again or erase it, so nothing disappears silently.
 */
export type SavedDisplayLoad =
  | { kind: 'none' }
  | { kind: 'saved'; record: SavedDisplayV1 }
  | { kind: 'unreadable'; reason: 'corrupt' | 'newer' }

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
const text = (value: unknown): string | null => typeof value === 'string' && value.trim().length > 0 && value.length <= 300 ? value : null

/** Re-projects every field: anything extra in storage never becomes app state. */
export function validateSavedDisplay(value: unknown): SavedDisplayV1 | null {
  const raw = record(value), church = record(raw?.church), link = record(raw?.link)
  if (!raw || !church || !link || raw.version !== 1) return null
  const savedAt = raw.savedAt
  const churchId = text(church.id), churchName = text(church.name), linkId = text(link.id), linkTitle = text(link.title), token = text(link.token)
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt) || savedAt < 0 || !churchId || !churchName || !linkId || !linkTitle || !token || /\s/.test(token)) return null
  if (church.locality !== null && church.locality !== undefined && text(church.locality) === null) return null
  return { version: 1, savedAt, church: { id: churchId, name: churchName, locality: church.locality == null ? null : String(church.locality) },
    link: { id: linkId, title: linkTitle, token } }
}

export function newSavedDisplay(church: SavedChurch, link: SavedLink, now: number): SavedDisplayV1 {
  return { version: 1, savedAt: now, church: { ...church }, link: { ...link } }
}

export async function loadSavedDisplay(store: KeyValueAdapter): Promise<SavedDisplayLoad> {
  let stored: string | null
  try { stored = await store.get(SAVED_DISPLAY_KEY) } catch { return { kind: 'unreadable', reason: 'corrupt' } }
  if (stored === null) return { kind: 'none' }
  let parsed: unknown
  try { parsed = JSON.parse(stored) } catch { return { kind: 'unreadable', reason: 'corrupt' } }
  const version = record(parsed)?.version
  if (typeof version === 'number' && version > 1) return { kind: 'unreadable', reason: 'newer' }
  const valid = validateSavedDisplay(parsed)
  return valid ? { kind: 'saved', record: valid } : { kind: 'unreadable', reason: 'corrupt' }
}

export class SavedDisplayStorageError extends Error {}

/** Writes, then reads back: a Keychain that accepts a write it cannot return must not look saved. */
export async function saveDisplay(store: KeyValueAdapter, saved: SavedDisplayV1): Promise<void> {
  const serialized = JSON.stringify(saved)
  try {
    await store.set(SAVED_DISPLAY_KEY, serialized)
    if ((await store.get(SAVED_DISPLAY_KEY)) !== serialized) throw new SavedDisplayStorageError('read-back mismatch')
  } catch (error) {
    throw error instanceof SavedDisplayStorageError ? error : new SavedDisplayStorageError('storage write failed')
  }
}

export async function resetSavedDisplay(store: KeyValueAdapter): Promise<void> {
  try { await store.remove(SAVED_DISPLAY_KEY) } catch { throw new SavedDisplayStorageError('storage remove failed') }
}
