import { useCallback, useReducer } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import type { Endpoints } from '@tarkman/reader'
import { useMenuBack } from './hooks'
import { I18nProvider } from './i18n'
import { canGoBack, currentRoute, initialNavigation, navigate } from './navigation'
import { PreferencesProvider } from './preferences'
import { readerConfig, type ReaderTransport } from './reader'
import { DisplaySetupScreen } from './screens/DisplaySetupScreen'
import { DisplayScreen } from './screens/DisplayScreen'
import { ServicesScreen } from './screens/ServicesScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { colors, safe, type } from './theme'

const config = readerConfig()

/** QA only: EXPO_PUBLIC_TV_START_SERVICE=<id> opens that service at launch, for simulator captures. */
function startState() {
  const id = Number(process.env.EXPO_PUBLIC_TV_START_SERVICE)
  return Number.isSafeInteger(id) && id > 0 ? navigate(initialNavigation, { type: 'push', route: { name: 'reader', id } }) : initialNavigation
}

export function App() {
  return (
    <I18nProvider>
      <PreferencesProvider>
        <StatusBar style="light" />
        {config.endpoints ? <Navigator endpoints={config.endpoints} />
          : <View style={styles.error}><Text style={styles.errorText}>{config.error}</Text></View>}
      </PreferencesProvider>
    </I18nProvider>
  )
}

export function Navigator({ endpoints, transport }: { endpoints: Endpoints; transport?: ReaderTransport }) {
  const [state, dispatch] = useReducer(navigate, undefined, startState)
  const back = useCallback(() => dispatch({ type: 'back' }), [])
  useMenuBack(canGoBack(state), back)
  const route = currentRoute(state)
  switch (route.name) {
    case 'services': return <ServicesScreen endpoints={endpoints} transport={transport} lastServiceId={state.lastServiceId}
      onOpen={id => dispatch({ type: 'push', route: { name: 'reader', id } })}
      onDisplaySetup={() => dispatch({ type: 'push', route: { name: 'displaySetup' } })}
      onSettings={() => dispatch({ type: 'push', route: { name: 'settings' } })} />
    case 'reader': return <DisplayScreen key={route.id} endpoints={endpoints} transport={transport} id={route.id} onBack={back} />
    case 'settings': return <SettingsScreen onDone={back} />
    case 'displaySetup': return <DisplaySetupScreen onBack={back} />
  }
}

const styles = StyleSheet.create({
  error: { flex: 1, backgroundColor: colors.surfaceCanvas, padding: safe.horizontal, justifyContent: 'center' },
  errorText: { color: colors.textPrimary, fontSize: type.body },
})
