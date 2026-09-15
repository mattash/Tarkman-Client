import { useEffect, useState } from 'react'
import type { KeyValueAdapter } from '@tarkman/core'
import { preferencesStore } from '../preferences/storage'
import type { SavedServiceV1 } from './savedService'
import { loadSavedService } from './savedServiceStore'

/** Hydration never delays live recovery. The services list (null) never reads storage. */
export function useSavedService(id: number | null, store: KeyValueAdapter = preferencesStore, now: () => number = Date.now): SavedServiceV1 | null {
  const [loaded, setLoaded] = useState<{ id: number; record: SavedServiceV1 | null } | null>(null)
  useEffect(() => {
    if (id === null) return
    let active = true
    void loadSavedService(store, now).then(record => {
      if (active) setLoaded({ id, record: record?.session.id === id ? record : null })
    })
    return () => { active = false }
  }, [id, store, now])
  return id !== null && loaded?.id === id ? loaded.record : null
}
