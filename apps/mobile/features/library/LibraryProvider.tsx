import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { libraryConfiguration } from './config'
import { createLibrary, type LibraryController } from './downloadCoordinator'
import { libraryStore } from './store'

const Context = createContext<LibraryController | null>(null)
const unavailable = createLibrary('disabled', null, libraryStore)
export function LibraryProvider({ children, controller }: { children: ReactNode; controller?: LibraryController }) {
  const instance = useMemo(() => { const config = libraryConfiguration(); return controller ?? createLibrary(config.environment, config.api, libraryStore) }, [controller])
  const lifecycle = useRef(new Map<LibraryController, number>())
  useEffect(() => {
    const versions = lifecycle.current
    versions.set(instance, (versions.get(instance) ?? 0) + 1)
    void instance.hydrate()
    const subscription = AppState.addEventListener('change', value => { if (value !== 'active') instance.cancel() })
    return () => {
      subscription.remove(); instance.cancel()
      const generation = (versions.get(instance) ?? 0) + 1
      versions.set(instance, generation)
      // Strict Mode reattaches the same effect immediately. Cancel now, dispose only if not reattached.
      void Promise.resolve().then(() => { if (versions.get(instance) === generation) { versions.delete(instance); instance.dispose() } })
    }
  }, [instance])
  return <Context.Provider value={instance}>{children}</Context.Provider>
}
export function useLibrary() {
  const controller = useContext(Context) ?? unavailable
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return { controller, state }
}
