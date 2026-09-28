import { ScrollView, StyleSheet, Text, TVFocusGuideView, View } from 'react-native'
import type { Endpoints, LiveSession } from '@tarkman/reader'
import { FocusButton } from '../components/FocusButton'
import { statusName } from '../components/FreshnessBadge'
import { useOnline } from '../hooks'
import { useI18n } from '../i18n'
import { useReader, type ReaderTransport } from '../reader'
import { colors, safe, space, type } from '../theme'

interface Props {
  endpoints: Endpoints
  /** The service to focus on return, so Back lands where the viewer left. */
  lastServiceId: number | null
  onOpen(id: number): void
  onDisplaySetup(): void
  onSettings(): void
  transport?: ReaderTransport
}

/**
 * Unconfigured launch: today's live services from the public API, refreshed while foregrounded by the
 * engine's polling and reconnects. Labels come only from validated API data.
 */
export function ServicesScreen({ endpoints, lastServiceId, onOpen, onDisplaySetup, onSettings, transport }: Props) {
  const { t } = useI18n()
  const online = useOnline()
  const { state, retry } = useReader(endpoints, null, transport)
  const services = state.services
  const failed = !!state.error && !state.loading
  // Deterministic initial focus: the service left last, else the first service, else the first action.
  const focusId = services.some(s => s.id === lastServiceId) ? lastServiceId : services[0]?.id ?? null

  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>{t('appName')}</Text>
      <Text style={styles.title} accessibilityRole="header">{t('services.title')}</Text>
      <Text style={styles.intro}>{t('services.intro')}</Text>

      <TVFocusGuideView autoFocus style={styles.list}>
        {state.loading && !services.length ? <Text testID="services-loading" style={styles.messageText}>{t('services.loading')}</Text>
          : failed && !services.length ? (
            <View style={styles.message}>
              <Text testID="services-failed" style={styles.messageText}>{online ? t('services.failed') : t('errors.noNetwork')}</Text>
              <View style={styles.inline}><FocusButton testID="services-retry" label={t('services.retry')} variant="primary" hasTVPreferredFocus onPress={retry} /></View>
            </View>
          ) : !services.length ? (
            <View style={styles.message}>
              <Text testID="services-empty" style={styles.messageText}>{t('services.empty')}</Text>
              <Text style={styles.hint}>{t('services.emptyHint')}</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.cards}>
              {services.map(service => (
                <ServiceCard key={service.id} service={service} preferred={service.id === focusId} onPress={() => onOpen(service.id)} />
              ))}
            </ScrollView>
          )}
      </TVFocusGuideView>

      <TVFocusGuideView autoFocus style={styles.actions}>
        <FocusButton testID="display-setup" label={t('home.displaySetup')} detail={t('home.displaySetupHint')}
          hasTVPreferredFocus={!state.loading && !services.length && !failed} onPress={onDisplaySetup} />
        <FocusButton testID="open-settings" label={t('home.settings')} onPress={onSettings} />
      </TVFocusGuideView>
    </View>
  )
}

function ServiceCard({ service, preferred, onPress }: { service: LiveSession; preferred: boolean; onPress(): void }) {
  const { t } = useI18n()
  const status = service.status !== 'active' ? statusName(service.status, t) : null
  const label = status ? t('services.rowStatusLabel', { title: service.title, church: service.church, status })
    : t('services.rowLabel', { title: service.title, church: service.church })
  return (
    <View style={styles.cardSlot}>
      <FocusButton testID={`service-${service.id}`} variant="card" label={service.church} detail={status ? `${service.title} · ${status}` : service.title}
        accessibilityLabel={label} hasTVPreferredFocus={preferred} onPress={onPress} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceCanvas, paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical },
  brand: { color: colors.textSecondary, fontSize: type.label, fontWeight: '600', letterSpacing: 1 },
  title: { color: colors.textPrimary, fontSize: type.title, fontWeight: '700', marginTop: space.xs },
  intro: { color: colors.textSecondary, fontSize: type.body, marginTop: space.xs },
  list: { flex: 1, marginTop: space.sm, marginHorizontal: -space.xl },
  cards: { gap: space.md, paddingVertical: space.lg, paddingHorizontal: space.xl },
  cardSlot: { maxWidth: 1100 },
  message: { gap: space.md, paddingHorizontal: space.xl },
  messageText: { color: colors.textPrimary, fontSize: type.heading },
  hint: { color: colors.textSecondary, fontSize: type.body },
  inline: { flexDirection: 'row' },
  actions: { flexDirection: 'row', gap: space.lg, paddingTop: space.md },
})
