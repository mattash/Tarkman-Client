import { useCallback, useEffect, useRef, useState } from 'react'
import type { Language } from '@tarkman/core'
import type { LibraryController } from './downloadCoordinator'
import type { Bundle } from './contracts'
import { MAX_BOOKMARKS, type PassageAnchor, type ReadingMetadata } from './readingMetadata'
import { resolveTextJump } from './textFind'

const empty: ReadingMetadata = { version: 1, resume: null, bookmarks: [] }

/** One opening lease. A removal closes this reader permanently, even if the service is downloaded again. */
export function useReadingPositions(controller: LibraryController, id: number, bundle: Bundle | undefined, enabled: boolean) {
  const [lease] = useState(() => controller.readingEpoch(id))
  const current = controller.isContentCurrent(id, lease)
  const [metadata, setMetadata] = useState<ReadingMetadata>(empty)
  const [ready, setReady] = useState(false), [storageFailed, setStorageFailed] = useState(false)
  const [position, setPosition] = useState<PassageAnchor | null>(null)
  const latest = useRef<PassageAnchor | null>(null), browsing = useRef(false), hydrated = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const writable = () => enabled && current && controller.isContentCurrent(id, lease)
  useEffect(() => {
    let active = true
    if (!enabled || !current) return
    void controller.reading.read(id, lease).then(result => {
      if (!active || !controller.isContentCurrent(id, lease)) return
      hydrated.current = result.status === 'ready'
      setMetadata(result.value); setReady(true); setStorageFailed(result.status === 'storage')
    })
    return () => { active = false }
  }, [controller, id, lease, enabled, current])
  const persist = useCallback((anchor: PassageAnchor) => {
    if (!controller.isContentCurrent(id, lease)) return
    void controller.reading.saveResume(id, anchor, lease).then(status => {
      if (controller.isContentCurrent(id, lease)) {
        setStorageFailed(status === 'storage')
        if (status === 'ready') setMetadata(value => ({ ...value, resume: anchor }))
      }
    })
  }, [controller, id, lease])
  useEffect(() => () => {
    clearTimeout(timer.current)
    // Flush a settled manual position on leaving; the controller rechecks the removal lease.
    if (hydrated.current && browsing.current && latest.current) persist(latest.current)
  }, [persist])
  const moved = () => { browsing.current = true }
  const visible = (passage: { key: string; language: Language; start: number; end: number }) => {
    if (!bundle || !writable()) return
    const index = bundle.parts.findIndex(part => `library:${part.liturgy_part_id}` === passage.key)
    const part = bundle.parts[index]
    if (!part) return
    const anchor: PassageAnchor = { liturgyId: id, revision: bundle.revision, language: passage.language,
      liturgyPartId: part.liturgy_part_id, partId: part.part_id, occurrenceIndex: index, start: passage.start, end: passage.end }
    if (!resolveTextJump(bundle, anchor, passage.language)) return
    latest.current = anchor
    setPosition(previous => previous && JSON.stringify(previous) === JSON.stringify(anchor) ? previous : anchor)
    if (browsing.current && hydrated.current) {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => persist(anchor), 500)
    }
  }
  const update = async (operation: () => Promise<string>) => {
    if (!writable()) return
    const status = await operation()
    if (!controller.isContentCurrent(id, lease)) return
    setStorageFailed(status === 'storage')
    if (status === 'ready') {
      const result = await controller.reading.read(id, lease)
      if (controller.isContentCurrent(id, lease)) { hydrated.current = result.status === 'ready'; setMetadata(result.value); setStorageFailed(result.status === 'storage') }
    }
  }
  return {
    lease, current, metadata, ready, storageFailed, position, moved, visible,
    capacity: metadata.bookmarks.length >= MAX_BOOKMARKS && !metadata.bookmarks.some(anchor => JSON.stringify(anchor) === JSON.stringify(position)),
    save: () => position && update(() => controller.reading.addBookmark(id, position, lease)),
    remove: (anchor: PassageAnchor) => update(() => controller.reading.removeBookmark(id, anchor, lease)),
    clearResume: () => {
      browsing.current = false; clearTimeout(timer.current)
      return update(() => controller.reading.clearResume(id, lease))
    },
    resume: (anchor: PassageAnchor) => { if (writable()) { latest.current = anchor; browsing.current = true; persist(anchor) } },
  }
}
