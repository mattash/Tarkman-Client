import { StyleSheet, Text, View } from 'react-native'
import { useI18n } from '../i18n'
import { liveChip, space, type } from '../theme'

/** "Live": shown only while the list is fresh. On the lifted white focus surface it turns dark green. */
export function LiveChip({ focused }: { focused: boolean }) {
  const { t } = useI18n()
  const color = focused ? liveChip.textOnFocus : liveChip.text
  return (
    <View testID="live-chip" style={[styles.chip, { backgroundColor: focused ? liveChip.surfaceOnFocus : liveChip.surface, borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{t('services.live')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, paddingHorizontal: space.sm + 2, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  label: { fontSize: type.caption, fontWeight: '600' },
})
