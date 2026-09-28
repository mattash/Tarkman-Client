import { StyleSheet, Text, View } from 'react-native'
import type { Freshness } from '../freshness'
import { useI18n, type MessageKey } from '../i18n'
import { colors, radius, space, type } from '../theme'

const tone: Record<Freshness['kind'], { color: string; background: string }> = {
  live: { color: colors.success, background: colors.successSurface },
  connecting: { color: colors.info, background: colors.infoSurface },
  reconnecting: { color: colors.info, background: colors.infoSurface },
  offline: { color: colors.onDisabled, background: colors.disabled },
  stale: { color: colors.danger, background: colors.dangerSurface },
  status: { color: colors.warning, background: colors.warningSurface },
  ended: { color: colors.textSecondary, background: colors.surfaceRaised },
  unavailable: { color: colors.textSecondary, background: colors.surfaceRaised },
}

export function FreshnessBadge({ value, showDetail = true }: { value: Freshness; showDetail?: boolean }) {
  const { t } = useI18n()
  const { label, detail } = describe(value, t)
  const { color, background } = tone[value.kind]
  return (
    <View testID="freshness" accessible accessibilityLabel={detail ? `${label}. ${detail}` : label} style={styles.row}>
      <View style={[styles.pill, { backgroundColor: background }]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text testID="freshness-label" style={[styles.label, { color }]}>{label}</Text>
      </View>
      {showDetail && detail ? <Text style={styles.detail} numberOfLines={2}>{detail}</Text> : null}
    </View>
  )
}

export function describe(value: Freshness, t: (key: MessageKey, params?: Record<string, string>) => string): { label: string; detail: string | null } {
  switch (value.kind) {
    case 'live': return { label: t('freshness.live'), detail: t('freshness.liveDetail') }
    case 'connecting': return { label: t('freshness.connecting'), detail: null }
    case 'reconnecting': return { label: t('freshness.reconnecting'), detail: t('freshness.reconnectingDetail') }
    case 'offline': return { label: t('freshness.offline'), detail: t('freshness.offlineDetail') }
    case 'stale': return { label: t('freshness.stale'), detail: value.message ?? t('freshness.staleDetail') }
    case 'ended': return { label: t('freshness.ended'), detail: t('freshness.endedDetail') }
    case 'unavailable': return { label: t('freshness.unavailable'), detail: value.message }
    case 'status': return {
      label: value.status === 'paused' ? t('freshness.paused') : statusName(value.status, t),
      detail: value.message,
    }
  }
}

/** Known statuses are named; an unknown future status is shown as sent, never guessed. */
export function statusName(status: string, t: (key: MessageKey) => string): string {
  const key = `statuses.${status}` as MessageKey
  const name = t(key)
  return name === key ? status.replaceAll('_', ' ') : name
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexShrink: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius },
  dot: { width: 16, height: 16, borderRadius: 8 },
  label: { fontSize: type.label, fontWeight: '700' },
  detail: { color: colors.textSecondary, fontSize: type.caption, flexShrink: 1 },
})
