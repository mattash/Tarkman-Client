import { useState } from 'react'
import { Keyboard, ScrollView, View } from 'react-native'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { Card } from '../../components/Surface'
import { TextField } from '../../components/TextField'
import { spacing } from '../../design/tokens'
import type { Endpoints } from './config'
import { useReader } from './useReader'
import { ReaderStatus } from './ReaderStatus'
import { useNearbyChurch } from '../nearby/useNearbyChurch'
export function Discovery({ endpoints, open }: { endpoints: Endpoints; open(id: number): void }) {
  const { state, retry } = useReader(endpoints, null)
  const nearby = useNearbyChurch(state.services)
  const [input, setInput] = useState(''), [error, setError] = useState<string>()
  function submit() {
    const id = Number(input)
    if (!/^\d+$/.test(input) || !Number.isSafeInteger(id) || id <= 0) { setError('Enter a valid numeric session ID.'); return }
    Keyboard.dismiss(); open(id)
  }
  return <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: spacing.lg }}>
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: spacing.lg }}>
      <AppText variant="label" tone="accent">TARKMAN / LIVE</AppText>
      <AppText variant="title">Follow the service.</AppText>
      <AppText tone="muted">Find a public service and read along in your language.</AppText>
      <ReaderStatus state={state} retry={retry} />
      {!state.loading && !state.error && state.services.length === 0 && <Card><AppText variant="heading">No live service right now</AppText><AppText tone="muted">Check again later, or open a session by its ID.</AppText></Card>}
      {nearby.state.status === 'found' && <Card testID="nearby-church">
        <AppText variant="label" tone="accent">NEARBY</AppText>
        <AppText variant="heading">{`You appear to be at ${nearby.state.nearby.session.church}`}</AppText>
        <AppText tone="muted">{nearby.state.nearby.session.title}</AppText>
        <AppButton onPress={() => open(nearby.state.status === 'found' ? nearby.state.nearby.session.id : 0)}
          accessibilityLabel={`Open this service at ${nearby.state.nearby.session.church}`}>Open this service</AppButton>
        <AppButton variant="quiet" onPress={nearby.reset}>Not where I am</AppButton>
      </Card>}
      {state.services.map(session => <Card key={session.id}><AppText variant="heading">{session.church}</AppText><AppText>{session.title}</AppText>
        <AppButton onPress={() => open(session.id)} accessibilityLabel={`Open ${session.title} at ${session.church}`}>Open service</AppButton></Card>)}
      {state.services.some(session => session.latitude !== null) && nearby.state.status !== 'found' && <Card>
        <AppText variant="heading">At a church right now?</AppText>
        <AppText tone="muted">Tarkman can check which church you are in. Your location stays on this device and is never sent anywhere.</AppText>
        {nearby.state.status === 'none' && <AppText accessibilityLiveRegion="polite">No church with a live service is nearby.</AppText>}
        {nearby.state.status === 'unavailable' && <AppText accessibilityRole="alert">Your location is not available right now.</AppText>}
        {nearby.state.status === 'refused' && <AppText accessibilityRole="alert">
          {nearby.state.canAskAgain ? 'Location was not allowed, so the list above is unchanged.' : 'Location is turned off for Tarkman in the Settings app.'}
        </AppText>}
        {!(nearby.state.status === 'refused' && !nearby.state.canAskAgain) &&
          <AppButton variant="secondary" loading={nearby.state.status === 'looking'} onPress={() => { void nearby.find() }}>Find my church</AppButton>}
      </Card>}
      <AppButton variant="secondary" loading={state.refreshing} onPress={retry}>Refresh services</AppButton>
      <Card><AppText variant="heading">Have a session ID?</AppText>
        <TextField testID="session-id" label="Session ID" value={input} onChangeText={value => { setInput(value); setError(undefined) }} keyboardType="number-pad" inputMode="numeric" returnKeyType="go" onSubmitEditing={submit} error={error} />
        <AppButton onPress={submit}>Open session</AppButton>
      </Card>
    </View>
  </ScrollView>
}
