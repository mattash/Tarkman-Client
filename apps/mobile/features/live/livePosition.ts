import { useSyncExternalStore } from 'react'
import type { LivePart } from './contracts'

/**
 * Where an open reading list says its service is. Part detail is a sibling route of the list, so the
 * list's reader publishes here and part detail only reads it: no second poll or subscription is opened.
 */
export interface LivePosition {
  sessionId: number
  parts: readonly LivePart[]
  currentKey: string | undefined
  /** Returns the list to following the service. */
  follow(): void
}

let position: LivePosition | null = null
const listeners = new Set<() => void>()

function emit() { listeners.forEach(listener => listener()) }

export function publishLivePosition(next: LivePosition): () => void {
  position = next
  emit()
  return () => {
    if (position !== next) return
    position = null
    emit()
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The published position for this service, or null when no reading list for it is open (for example a shared part link). */
export function useLivePosition(sessionId: number): LivePosition | null {
  const snapshot = useSyncExternalStore(subscribe, () => position, () => position)
  return snapshot?.sessionId === sessionId ? snapshot : null
}

/** The live part, only once the service has moved past the part being read. */
export function movedPast(live: LivePosition | null, readKey: string | undefined): LivePart | undefined {
  if (!live || !readKey || !live.currentKey) return undefined
  const read = live.parts.findIndex(part => part.key === readKey)
  const current = live.parts.findIndex(part => part.key === live.currentKey)
  return read >= 0 && current > read ? live.parts[current] : undefined
}
