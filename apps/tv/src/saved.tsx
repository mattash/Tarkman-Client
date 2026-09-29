import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { KeyValueAdapter } from '@tarkman/core'
import { loadSavedDisplay, newSavedDisplay, resetSavedDisplay, saveDisplay, type SavedChurch, type SavedDisplayLoad, type SavedLink } from './savedDisplay'

export interface SavedDisplayContext {
  /** True until storage has been read once, so launch never picks a route from a guess. */
  loading: boolean
  load: SavedDisplayLoad
  /** Rejects with SavedDisplayStorageError when the write cannot be confirmed; nothing changes then. */
  save(church: SavedChurch, link: SavedLink): Promise<void>
  reset(): Promise<void>
}
const inert: SavedDisplayContext = {
  loading: false, load: { kind: 'none' },
  save: () => Promise.reject(new Error('no saved-display provider')), // i18n-ignore: developer error
  reset: () => Promise.resolve(),
}
const Context = createContext<SavedDisplayContext>(inert)

/** Reads the saved display once at launch; later changes go through save and reset only. */
export function SavedDisplayProvider({ store, children, now = Date.now }: { store: KeyValueAdapter; children: ReactNode; now?: () => number }) {
  const [state, setState] = useState<{ loading: boolean; load: SavedDisplayLoad }>({ loading: true, load: { kind: 'none' } })
  const changed = useRef(false)
  useEffect(() => {
    let alive = true
    void loadSavedDisplay(store).then(load => {
      // A save or reset that finished first is newer than this launch read.
      if (alive && !changed.current) setState({ loading: false, load })
      else if (alive) setState(current => ({ ...current, loading: false }))
    })
    return () => { alive = false }
  }, [store])
  const save = useCallback(async (church: SavedChurch, link: SavedLink) => {
    const record = newSavedDisplay(church, link, now())
    await saveDisplay(store, record)
    changed.current = true
    setState({ loading: false, load: { kind: 'saved', record } })
  }, [store, now])
  const reset = useCallback(async () => {
    await resetSavedDisplay(store)
    changed.current = true
    setState({ loading: false, load: { kind: 'none' } })
  }, [store])
  const value = useMemo<SavedDisplayContext>(() => ({ ...state, save, reset }), [state, save, reset])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useSavedDisplay(): SavedDisplayContext { return useContext(Context) }
