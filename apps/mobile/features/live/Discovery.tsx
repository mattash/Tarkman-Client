import { useState } from 'react'
import { Keyboard, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { Card } from '../../components/Surface'
import { TextField } from '../../components/TextField'
import { spacing } from '../../design/tokens'
import type { Endpoints } from './config'
import { useReader } from './useReader'
import { ReaderStatus } from './ReaderStatus'
export function Discovery({ endpoints, open }: { endpoints: Endpoints; open(id: number): void }) {
  const { state, retry } = useReader(endpoints, null)
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
      {state.services.map(session => <Card key={session.id}><AppText variant="heading">{session.church}</AppText><AppText>{session.title}</AppText>
        <AppButton onPress={() => open(session.id)} accessibilityLabel={`Open ${session.title} at ${session.church}`}>Open service</AppButton></Card>)}
      <AppButton variant="secondary" loading={state.refreshing} onPress={retry}>Refresh services</AppButton>
      <Card><AppText variant="heading">Have a session ID?</AppText>
        <TextField testID="session-id" label="Session ID" value={input} onChangeText={value => { setInput(value); setError(undefined) }} keyboardType="number-pad" inputMode="numeric" returnKeyType="go" onSubmitEditing={submit} error={error} />
        <AppButton onPress={submit}>Open session</AppButton>
        <AppButton variant="secondary" onPress={() => router.push('/scan')}>Scan a service code</AppButton>
      </Card>
    </View>
  </ScrollView>
}
