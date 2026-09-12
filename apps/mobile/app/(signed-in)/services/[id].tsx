import { useState } from 'react'
import { FlatList, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import type { KnownSessionStatus } from '@tarkman/core'
import { AppButton } from '../../../components/AppButton'
import { AppText } from '../../../components/AppText'
import { Card } from '../../../components/Surface'
import { TextField } from '../../../components/TextField'
import { useTheme } from '../../../design/ThemeProvider'
import { spacing } from '../../../design/tokens'
import { useAuth } from '../../../features/auth/AuthProvider'
import { readerConfig } from '../../../features/live/config'
import { currentPart } from '../../../features/live/contracts'
import { ReaderStatus } from '../../../features/live/ReaderStatus'
import { useReader } from '../../../features/live/useReader'
import { statusLabel } from '../../../features/services/api'
import { createServiceControls } from '../../../features/services/controls'
import { useControls } from '../../../features/services/useControls'

const READING_STATUSES: KnownSessionStatus[] = ['active', 'paused', 'showing_gospel', 'showing_epistle', 'showing_welcome']

export default function ServiceControlScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const sessionId = Number(id)
  const { authorizedFetch } = useAuth()
  const { colors } = useTheme()
  const config = readerConfig()
  const [message, setMessage] = useState('')
  const { state, retry } = useReader(config.endpoints ?? { api: '', cable: '' }, Number.isInteger(sessionId) && sessionId > 0 ? sessionId : null)
  const controls = useControls(retry)
  const commands = createServiceControls(authorizedFetch)
  const part = state.session ? currentPart(state.session, state.parts) : undefined
  const busy = controls.running !== null || !controls.online

  if (!Number.isInteger(sessionId) || sessionId <= 0 || !config.endpoints) {
    return <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
      <AppText accessibilityRole="alert">{config.endpoints ? 'That service link is not valid.' : config.error}</AppText>
      <AppButton variant="secondary" onPress={() => router.replace('/services')}>My services</AppButton>
    </View>
  }

  const header = <View style={{ gap: spacing.md }}>
    <View style={{ alignSelf: 'flex-start' }}>
      <AppButton variant="quiet" onPress={() => { if (router.canGoBack()) { router.back() } else { router.replace('/services') } }}>My services</AppButton>
    </View>
    <AppText variant="title">{state.session?.title ?? `Service ${sessionId}`}</AppText>
    <AppText tone="muted">{`Status: ${statusLabel(state.session?.status ?? 'active')}${state.session?.message ? ` · ${state.session.message}` : ''}`}</AppText>
    <ReaderStatus state={state} retry={retry} />
    {!controls.online && <AppText accessibilityRole="alert">You are offline. Reconnect before changing the service.</AppText>}
    {controls.error && <AppText tone="destructive" accessibilityRole="alert">{controls.error}</AppText>}

    <Card>
      <AppText variant="label" tone="accent">Current part</AppText>
      <AppText variant="heading">{part ? `${part.position} / ${part.role}` : 'No current part'}</AppText>
      {part && <AppText tone="muted" numberOfLines={3}>{part.text.en ?? ''}</AppText>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <AppButton loading={controls.running === 'previous'} disabled={busy} onPress={() => controls.run('previous', () => commands.previous(sessionId, part?.id ?? null))}>Previous part</AppButton>
        <AppButton loading={controls.running === 'next'} disabled={busy} onPress={() => controls.run('next', () => commands.next(sessionId, part?.id ?? null))}>Next part</AppButton>
      </View>
    </Card>

    <Card>
      <AppText variant="label" tone="accent">What the congregation sees</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {READING_STATUSES.map(status => <AppButton key={status} variant={state.session?.status === status ? 'primary' : 'secondary'}
          accessibilityState={{ selected: state.session?.status === status }} loading={controls.running === status} disabled={busy}
          onPress={() => controls.run(status, () => commands.setStatus(sessionId, status))}>{statusLabel(status)}</AppButton>)}
      </View>
    </Card>

    <Card>
      <AppText variant="label" tone="accent">Custom announcement</AppText>
      <TextField label="Message" value={message} onChangeText={setMessage} editable={!busy} multiline returnKeyType="done" />
      <AppButton loading={controls.running === 'showing_custom'} disabled={busy || message.trim().length === 0}
        onPress={() => controls.run('showing_custom', () => commands.setStatus(sessionId, 'showing_custom', message.trim()))}>Show this message</AppButton>
    </Card>

    <AppText variant="label" tone="accent">Go to a part</AppText>
  </View>

  return <FlatList data={state.parts} keyExtractor={item => item.key} ListHeaderComponent={header}
    contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 760, alignSelf: 'center' }}
    ListEmptyComponent={state.loading ? null : <AppText>No reading parts are available for this service.</AppText>}
    renderItem={({ item }) => <Card style={{ borderWidth: 2, borderColor: item.key === part?.key ? colors.primary : 'transparent' }}>
      <AppText variant="label" tone={item.key === part?.key ? 'accent' : 'muted'}>{`${item.position} / ${item.role}${item.key === part?.key ? ' · Current part' : ''}`}</AppText>
      <AppText numberOfLines={2}>{item.text.en ?? ''}</AppText>
      <AppButton variant="secondary" accessibilityLabel={`Go to part ${item.position}`} loading={controls.running === item.key}
        disabled={busy || item.key === part?.key} onPress={() => controls.run(item.key, () => commands.goToPart(sessionId, item.id, part?.id ?? null))}>Go here</AppButton>
    </Card>} />
}
