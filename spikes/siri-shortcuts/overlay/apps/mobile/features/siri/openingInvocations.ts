import { readLibraryId } from '../links/libraryLink'

export interface OpeningInvocation {
  id: string
  name: string
  params: Record<string, unknown>
}

/** Only app navigation: the existing reader owns availability, revocation and fetching. */
export function openingPath(invocation: OpeningInvocation): `/liturgies/${string}` | null {
  if (invocation.name !== 'openLiturgy') return null
  const id = readLibraryId(invocation.params.liturgyId)
  return `/liturgies/${Number.isNaN(id) ? 'invalid' : id}`
}

/** Stable per-mounted-consumer serialization; failed acknowledgments remain pending. */
export function createOpeningConsumer(navigate: (path: `/liturgies/${string}`) => void, acknowledge: (id: string) => Promise<void>,
  observe?: (stage: 'queue:received' | 'route:accepted' | 'ack:ok' | 'handler:error', id: string) => void | Promise<void>) {
  const record = (stage: 'queue:received' | 'route:accepted' | 'ack:ok' | 'handler:error', id: string) => {
    try { void Promise.resolve(observe?.(stage, id)).catch(() => {}) } catch { /* Observation cannot change the action. */ }
  }
  const applied = new Set<string>()
  let tail = Promise.resolve()
  return (invocations: readonly OpeningInvocation[]) => {
    tail = tail.then(async () => {
      for (const invocation of invocations) {
        const path = openingPath(invocation)
        if (path === null) continue
        record('queue:received', invocation.id)
        try {
          if (!applied.has(invocation.id)) {
            navigate(path)
            applied.add(invocation.id)
            record('route:accepted', invocation.id)
          }
          await acknowledge(invocation.id)
          record('ack:ok', invocation.id)
        } catch {
          record('handler:error', invocation.id)
          // A later queue event can retry acknowledgment, without repeating navigation.
          // No success dialog: dispatch/route acceptance is not reader-content success.
        }
      }
    })
    return tail
  }
}
