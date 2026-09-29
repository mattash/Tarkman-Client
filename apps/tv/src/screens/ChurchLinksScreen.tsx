import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, TVFocusGuideView, View } from 'react-native'
import { InvalidDisplayLinkError, type DisplayLinkApi } from '@tarkman/reader'
import { FocusButton } from '../components/FocusButton'
import { DirectoryError, type DirectoryLink, type PublicDirectoryApi } from '../directory'
import { useI18n } from '../i18n'
import { useSavedDisplay } from '../saved'
import { SavedDisplayStorageError } from '../savedDisplay'
import { colors, safe, space, type } from '../theme'
import { useLoad } from '../useLoad'

interface Props {
  api: PublicDirectoryApi
  linkApi: DisplayLinkApi
  churchId: string
  /** Called after the choice is confirmed and stored; the caller makes the saved display the launch root. */
  onSaved(): void
  onBack(): void
}

/**
 * Installation setup, step two: this church's intentionally published displays. Choosing one checks it
 * with the public token read first, then stores it. Nothing is stored until a display is chosen, so
 * backing out keeps whatever this TV opened before.
 */
export function ChurchLinksScreen({ api, linkApi, churchId, onSaved, onBack }: Props) {
  const { t } = useI18n()
  const saved = useSavedDisplay()
  const [result, reload] = useLoad(`links:${churchId}`, useCallback((signal: AbortSignal) => api.links(churchId, signal), [api, churchId]))
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<'unavailable' | 'checkFailed' | 'saveFailed' | null>(null)
  const current = saved.load.kind === 'saved' ? saved.load.record : null

  async function choose(link: DirectoryLink) {
    if (result.status !== 'ready' || busy) return
    setBusy(link.id); setProblem(null)
    try {
      await linkApi.link(link.token)
      await saved.save(result.data.church, link)
      onSaved()
    } catch (error) {
      setBusy(null)
      setProblem(error instanceof InvalidDisplayLinkError ? 'unavailable' : error instanceof SavedDisplayStorageError ? 'saveFailed' : 'checkFailed')
    }
  }

  const notFound = result.status === 'error' && result.error instanceof DirectoryError && result.error.kind === 'not_found'
  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">{result.status === 'ready' ? t('churchLinks.title', { church: result.data.church.name }) : t('churches.title')}</Text>
      <Text style={styles.intro}>{t('churchLinks.intro')}</Text>
      {current ? <Text testID="links-replaces" style={styles.hint}>{t('churchLinks.replaces', { title: current.link.title, church: current.church.name })}</Text> : null}

      <TVFocusGuideView autoFocus style={styles.list}>
        {result.status === 'loading' ? <Text testID="links-loading" style={styles.messageText}>{t('churchLinks.loading')}</Text>
          : result.status === 'error' ? (
            <View style={styles.message}>
              <Text testID={notFound ? 'links-not-found' : 'links-failed'} style={styles.messageText}>{notFound ? t('churchLinks.notFound') : t('churchLinks.failed')}</Text>
              {notFound ? null : <View style={styles.inline}><FocusButton testID="links-retry" label={t('churchLinks.retry')} variant="primary" hasTVPreferredFocus onPress={reload} /></View>}
            </View>
          ) : !result.data.links.length ? <Text testID="links-empty" style={styles.messageText}>{t('churchLinks.empty')}</Text>
          : (
            <ScrollView contentContainerStyle={styles.cards}>
              {result.data.links.map((link, index) => (
                <View key={link.id} style={styles.cardSlot}>
                  <FocusButton testID={`link-${link.id}`} variant="card" label={link.title} detail={busy === link.id ? t('churchLinks.checking') : undefined}
                    hasTVPreferredFocus={index === 0} onPress={() => { void choose(link) }} />
                </View>
              ))}
            </ScrollView>
          )}
      </TVFocusGuideView>
      {problem ? <Text testID={`link-problem-${problem}`} accessibilityRole="alert" style={styles.problem}>{t(`churchLinks.${problem}`)}</Text> : null}

      <View style={styles.actions}><FocusButton testID="links-back" label={t('churchLinks.back')} onPress={onBack} /></View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceCanvas, paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical },
  title: { color: colors.textPrimary, fontSize: type.title, fontWeight: '700' },
  intro: { color: colors.textSecondary, fontSize: type.body, marginTop: space.xs },
  hint: { color: colors.textSecondary, fontSize: type.label, marginTop: space.xs },
  list: { flex: 1, marginTop: space.sm, marginHorizontal: -space.xl },
  cards: { gap: space.md, paddingVertical: space.lg, paddingHorizontal: space.xl },
  cardSlot: { maxWidth: 1100 },
  message: { gap: space.md, paddingHorizontal: space.xl },
  messageText: { color: colors.textPrimary, fontSize: type.heading, paddingHorizontal: space.xl, paddingVertical: space.lg },
  inline: { flexDirection: 'row' },
  problem: { color: colors.textPrimary, fontSize: type.body, paddingVertical: space.sm },
  actions: { flexDirection: 'row', paddingTop: space.md },
})
