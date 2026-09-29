import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { AppText } from '../../components/AppText'
import { useI18n } from '../i18n'
import { normalizeParts, normalizeSession } from '../live/contracts'
import { initialState } from '../live/state'
import { DEFAULT_DISPLAY_CONFIG } from './config'
import { DisplayFrame } from './DisplayFrame'
import { DisplayPresentation } from './DisplayProjection'
import { normalizeOverrides } from './normalize'

// Public-domain prayer excerpt, shared with the synthetic review fixture. No live service data.
const sample = {
  en: 'Our Father, who art in heaven,\nhallowed be thy name.\n\nThy kingdom come.\nThy will be done,\non earth as it is in heaven.', // i18n-ignore: sample liturgical content
  grabar: 'Հայր մեր, որ յերկինս ես,\nսուրբ եղիցի անուն քո։\n\nԵկեսցէ արքայութիւն քո,\nեղիցին կամք քո\nորպէս յերկինս եւ յերկրի։',
  translit: 'Hayr mer, vor hergins yes,\nsurp yeghitsi anun ko.\n\nYegestse arkayutyun ko,\nyeghitsin gamk ko\nvorbes hergins yev hergri.', // i18n-ignore: sample liturgical content
}

export function previewState(long: boolean) {
  const session = normalizeSession({ session: { id: 1, current_part_id: 1, current_liturgy_id: 1,
    current_liturgy_part_id: 1, current_part_position: 2, num_of_parts: 3, status: 'active', page: 24, posture: 'stand' } })
  const parts = normalizeParts({ parts: [{ part: { id: 1, liturgy_id: 1, liturgy_part_id: 1, position: 2,
    role: 'choir', effective_duration_ms: 30000, page: 24, posture: 'stand',
    ...Object.fromEntries(Object.entries(sample).map(([language, text]) => [language,
      long ? Array(language === 'en' ? 8 : 6).fill(text).join('\n\n') : text])),
  } }] })
  // One authored note so the setup preview can show the explanation cue when that setting is on.
  const explanations = [{ id: 1, title: 'Sample explanation', description: null, liturgyPartId: 1 }] // i18n-ignore: sample content
  return { ...initialState, session, parts, explanations, loading: false, stale: false, connected: true }
}

/** Unsaved preferences only. This route never resolves a token, authenticates or subscribes. */
export function DisplayPreview() {
  const params = useLocalSearchParams<Record<string, string | string[]>>()
  const { t } = useI18n()
  useEffect(() => {
    if (Platform.OS === 'web') window.parent.postMessage({ type: 'tarkman-display-preview-ready' }, '*')
  }, [])
  return <DisplayFrame>
    <AppText style={{ fontSize: 16, padding: 8, textAlign: 'center' }}>{t('display.previewLabel')}</AppText>
    <DisplayPresentation key={JSON.stringify(params)} config={{ ...DEFAULT_DISPLAY_CONFIG, ...normalizeOverrides(params) }}
      sessionId={1} state={previewState(params.sample === 'long')} preview />
  </DisplayFrame>
}
