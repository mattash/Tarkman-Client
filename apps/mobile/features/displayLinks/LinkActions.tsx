import { useEffect, useRef, useState } from 'react'
import { findNodeHandle, Linking, Platform, View } from 'react-native'
import type { ManagedDisplayLink } from '@tarkman/core'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { AppModal } from '../../components/AppModal'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { expiredLink, platformShare, shareableUrl, type ShareAdapter } from './share'

export function LinkActions({ link, disabled = false, adapter = platformShare }: {
  link: ManagedDisplayLink; disabled?: boolean; adapter?: ShareAdapter
}) {
  const { t } = useI18n()
  const shareRef = useRef<View>(null), copyRef = useRef<View>(null)
  const lock = useRef(false), mounted = useRef(true)
  const [busy, setBusy] = useState(false), [manual, setManual] = useState(false), [notice, setNotice] = useState('')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { mounted.current = true; const timer = setInterval(() => setNow(Date.now()), 1000); return () => { mounted.current = false; clearInterval(timer) } }, [])
  const blocked = disabled || expiredLink(link.expires_at, now) || !shareableUrl(link.display_url)
  const allowed = () => !blocked && !lock.current && !expiredLink(link.expires_at)
  function share() {
    if (!allowed()) return
    lock.current = true; setBusy(true); setNotice('')
    const anchor = Platform.OS === 'web' ? undefined : findNodeHandle(shareRef.current) ?? undefined
    // Invocation stays in the user event; only the completion is asynchronous.
    void adapter.share(link.display_url, link.title, t('links.shareMessage'), anchor).then(result => {
      if (mounted.current && result === 'copy') setNotice(t('links.shareFallback'))
    }).finally(() => { lock.current = false; if (mounted.current) setBusy(false) })
  }
  function copy() {
    if (!allowed()) return
    lock.current = true; setBusy(true); setNotice('')
    void adapter.copy(link.display_url).then(success => {
      if (!mounted.current) return
      if (success) setNotice(t('links.copied')); else setManual(true)
    }).finally(() => { lock.current = false; if (mounted.current) setBusy(false) })
  }
  return <View style={{ gap: spacing.sm }}>
    {expiredLink(link.expires_at, now) && <AppText tone="destructive">{t('links.expired')}</AppText>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      <AppButton ref={shareRef} variant="secondary" disabled={blocked || busy} onPress={share} accessibilityLabel={t('links.shareTitle', { title: link.title })}>{t('links.share')}</AppButton>
      <AppButton ref={copyRef} variant="quiet" disabled={blocked || busy} onPress={copy} accessibilityLabel={t('links.copyTitle', { title: link.title })}>{t('links.copy')}</AppButton>
      <AppButton variant="quiet" disabled={blocked || busy} onPress={() => {
        if (allowed()) void Linking.openURL(link.display_url).catch(() => { if (mounted.current) setNotice(t('links.openFailed')) })
      }} accessibilityLabel={t('links.openTitle', { title: link.title })}>{t('links.open')}</AppButton>
    </View>
    {!!notice && <AppText accessibilityLiveRegion="polite">{notice}</AppText>}
    <AppModal visible={manual && !blocked} onDismiss={() => setManual(false)} title={t('links.manualCopy')} openerRef={copyRef}>
      <AppText>{t('links.manualCopyHelp')}</AppText><AppText selectable>{link.display_url}</AppText>
    </AppModal>
  </View>
}
