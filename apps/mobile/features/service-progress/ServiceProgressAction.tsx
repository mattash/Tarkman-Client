import { useRef, useState } from 'react'
import { View } from 'react-native'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { useI18n } from '../i18n'
import { isServiceProgressAvailable, presentServiceProgress } from './native'

/** Opens native management only. Native owns verification, disclosure and any activity start. */
export function ServiceProgressAction({ selectedID, readerAPI }: { selectedID: number; readerAPI: string }) {
  const { t } = useI18n()
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<'unavailable' | 'failed' | null>(null)
  if (!isServiceProgressAvailable()) return null

  const open = async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setFeedback(null)
    try {
      const origin = progressReaderOrigin(readerAPI)
      if (!origin) { setFeedback('unavailable'); return }
      const result = await presentServiceProgress(selectedID, origin)
      if (result === 'unavailable' || result === 'unsupported') setFeedback('unavailable')
      else if (result !== 'presented') setFeedback('failed')
    } catch {
      // Defensive fallback: never render an exception, URL or native response.
      setFeedback('failed')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return <View>
    <AppButton variant="text" loading={busy} accessibilityHint={t('serviceProgress.openHint')} onPress={() => { void open() }}>
      {t('serviceProgress.open')}
    </AppButton>
    {feedback && <AppText variant="caption" accessibilityRole="alert">{t(`serviceProgress.${feedback}`)}</AppText>}
  </View>
}

function progressReaderOrigin(readerAPI: string): string | null {
  try {
    const url = new URL(readerAPI)
    // Native reads /s/:id at the root. Dropping a reader prefix could select a
    // different service namespace. Leave prefix support in the ordinary reader.
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) return null
    return url.origin
  } catch { return null }
}
