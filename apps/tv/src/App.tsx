import { useCallback, useEffect, useReducer } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { createPublicDirectoryApi } from './directory'
import type { Endpoints } from '@tarkman/reader'
import { displayLinkApi } from './displayLinks'
import { useMenuBack } from './hooks'
import { I18nProvider } from './i18n'
import { canGoBack, currentRoute, navigate, navigationFor, type Route } from './navigation'
import { PreferencesProvider } from './preferences'
import { readerConfig, type ReaderTransport } from './reader'
import { SavedDisplayProvider, useSavedDisplay } from './saved'
import { ChurchesScreen } from './screens/ChurchesScreen'
import { ChurchLinksScreen } from './screens/ChurchLinksScreen'
import { DisplayScreen } from './screens/DisplayScreen'
import { Backdrop } from './components/Backdrop'
import { SavedManageScreen } from './screens/SavedManageScreen'
import { SavedDisplayScreen } from './screens/SavedDisplayScreen'
import { SavedProblemScreen } from './screens/SavedProblemScreen'
import { ServicesScreen } from './screens/ServicesScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { keychainStore } from './storage'
import { colors, safe, type } from './theme'

const config = readerConfig()

/** QA only: EXPO_PUBLIC_TV_START_SERVICE=<id> opens that service at launch, for simulator captures. */
function startState(root: Route) {
  const id = Number(process.env.EXPO_PUBLIC_TV_START_SERVICE)
  const base = navigationFor(root)
  return Number.isSafeInteger(id) && id > 0 ? navigate(base, { type: 'push', route: { name: 'reader', id } }) : base
}

export function App() {
  return (
    <I18nProvider>
      <PreferencesProvider>
        <SavedDisplayProvider store={keychainStore}>
          <StatusBar style="light" />
          {config.endpoints ? <Launch endpoints={config.endpoints} />
            : <View style={styles.error}><Text style={styles.errorText}>{config.error}</Text></View>}
        </SavedDisplayProvider>
      </PreferencesProvider>
    </I18nProvider>
  )
}

/**
 * Chooses the first screen from the saved display, so a configured TV opens straight to it and never
 * flashes setup. Until storage has been read the screen is blank rather than a guess.
 */
export function Launch({ endpoints, transport, request }: { endpoints: Endpoints; transport?: ReaderTransport; request?: typeof fetch }) {
  const { loading, load } = useSavedDisplay()
  if (loading) return <View testID="launch-loading" style={styles.blank} />
  const root: Route = load.kind === 'saved' ? { name: 'savedDisplay' } : load.kind === 'unreadable' ? { name: 'savedProblem' } : { name: 'services' }
  // The backdrop sits behind every screen; a running display draws its own opaque canvas over it.
  return <View style={styles.root}><Backdrop /><Navigator endpoints={endpoints} transport={transport} request={request} initialRoot={root} /></View>
}

export function Navigator({ endpoints, transport, request, initialRoot = { name: 'services' } }: {
  endpoints: Endpoints; transport?: ReaderTransport; request?: typeof fetch; initialRoot?: Route
}) {
  const [state, dispatch] = useReducer(navigate, initialRoot, startState)
  const saved = useSavedDisplay()
  const back = useCallback(() => dispatch({ type: 'back' }), [])
  useMenuBack(canGoBack(state), back)
  const route = currentRoute(state)
  const manage = useCallback(() => dispatch({ type: 'push', route: { name: 'savedManage' } }), [])
  // A read that failed at launch and later succeeds moves off the problem screen by itself.
  const readable = saved.load.kind !== 'unreadable'
  useEffect(() => {
    if (route.name === 'savedProblem' && readable) dispatch({ type: 'root', route: saved.load.kind === 'saved' ? { name: 'savedDisplay' } : { name: 'services' } })
  }, [route.name, readable, saved.load.kind])
  const push = (next: Route) => dispatch({ type: 'push', route: next })
  const directory = createPublicDirectoryApi({ base: endpoints.api, request })
  // A saved or erased display becomes the new root, so Back can never return into a stale setup flow.
  const reset = async () => { await saved.reset(); dispatch({ type: 'root', route: { name: 'services' } }) }
  switch (route.name) {
    case 'services': return <ServicesScreen endpoints={endpoints} transport={transport} lastServiceId={state.lastServiceId}
      onOpen={id => push({ name: 'reader', id })} onDisplaySetup={() => push({ name: 'churches' })} onSettings={() => push({ name: 'settings' })} />
    case 'reader': return <DisplayScreen key={route.id} endpoints={endpoints} transport={transport} id={route.id} onBack={back} />
    case 'settings': return <SettingsScreen onDone={back} onChangeDisplay={() => push({ name: 'churches' })} onReset={reset} />
    case 'savedDisplay':
      return saved.load.kind === 'saved' ? <SavedDisplayScreen endpoints={endpoints} saved={saved.load.record} transport={transport} request={request}
        onManage={manage} onChangeDisplay={() => push({ name: 'churches' })} onBrowseServices={() => push({ name: 'services' })} onSettings={() => push({ name: 'settings' })} onReset={reset} /> : null
    case 'savedManage':
      return saved.load.kind === 'saved' ? <SavedManageScreen saved={saved.load.record} onChange={() => push({ name: 'churches' })}
        onBrowse={() => push({ name: 'services' })} onSettings={() => push({ name: 'settings' })} onReset={reset} /> : null
    case 'savedProblem':
      return <SavedProblemScreen reason={saved.load.kind === 'unreadable' ? saved.load.reason : 'corrupt'} onSetup={() => push({ name: 'churches' })}
        onServices={() => push({ name: 'services' })} onErase={reset} onRetry={saved.retry} />
    case 'churches': return <ChurchesScreen api={directory} preferredId={state.lastChurchId} onBack={back} onChoose={church => push({ name: 'churchLinks', churchId: church.id })} />
    case 'churchLinks': return <ChurchLinksScreen api={directory} linkApi={displayLinkApi(endpoints.api, request)} churchId={route.churchId} onBack={back}
      onSaved={() => dispatch({ type: 'root', route: { name: 'savedDisplay' } })} />
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  blank: { flex: 1, backgroundColor: colors.surfaceCanvas },
  error: { flex: 1, backgroundColor: colors.surfaceCanvas, padding: safe.horizontal, justifyContent: 'center' },
  errorText: { color: colors.textPrimary, fontSize: type.body },
})
