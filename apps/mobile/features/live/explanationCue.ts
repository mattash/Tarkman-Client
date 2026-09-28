import { explanationContextKey, explanationOwnerKey } from '@tarkman/reader'
import { currentPart, type LiveExplanation } from './contracts'
import type { Endpoints } from './config'
import type { ReaderState } from './state'

export { explanationContextKey, explanationOwnerKey }
export const readerScopeKey = (endpoints: Endpoints, id: number) => JSON.stringify([endpoints.api, endpoints.cable, id])
export interface ExplanationItem { readonly id: number; readonly fingerprint: string }
export interface ExplanationBatch {
  readonly readerScopeKey: string
  readonly readerInstanceToken: object
  readonly ownerKey: string
  readonly requestId: number
  readonly items: readonly ExplanationItem[]
}
export type ExplanationHistory = ReadonlyMap<string, ReadonlyMap<number, string>>
export function explanationItems(items: LiveExplanation[]): readonly ExplanationItem[] | null {
  const unique = new Map<number, string>()
  for (const item of items) {
    if (item.contentFingerprint === undefined || (unique.has(item.id) && unique.get(item.id) !== item.contentFingerprint)) return null
    unique.set(item.id, item.contentFingerprint)
  }
  return Object.freeze([...unique].sort(([a], [b]) => a - b).map(([id, fingerprint]) => Object.freeze({ id, fingerprint })))
}
export function newExplanationCount(history: ExplanationHistory, owner: string, items: readonly ExplanationItem[]): number {
  return items.filter(item => history.get(owner)?.get(item.id) !== item.fingerprint).length
}
export function acknowledgeExplanations(history: ExplanationHistory, batch: ExplanationBatch): ExplanationHistory {
  const next = new Map(history), seen = new Map(history.get(batch.ownerKey))
  batch.items.forEach(item => seen.set(item.id, item.fingerprint))
  next.set(batch.ownerKey, seen)
  return next
}
export function sameExplanationBatch(a: ExplanationBatch, b: ExplanationBatch): boolean {
  return a.readerScopeKey === b.readerScopeKey && a.readerInstanceToken === b.readerInstanceToken && a.ownerKey === b.ownerKey &&
    a.requestId === b.requestId && a.items.length === b.items.length && a.items.every((item, i) => item.id === b.items[i].id && item.fingerprint === b.items[i].fingerprint)
}
export function verifiedExplanationOwner(state: ReaderState): string | null {
  const part = state.session && currentPart(state.session, state.parts), proof = state.explanationProvenance
  if (!part || !state.session || state.session.status !== 'active' || !state.listed || !state.connected || state.stale || state.error || state.loading || state.explanationError) return null
  const owner = explanationOwnerKey(state.session.id, part.key)
  return proof.ownerKey === owner && proof.contextKey === explanationContextKey(state.session) &&
    (proof.status === 'ready' || proof.status === 'revalidating') ? owner : null
}
