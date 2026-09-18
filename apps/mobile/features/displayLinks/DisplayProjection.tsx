import { useEffect, useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import type { Language } from '@tarkman/core'
import { LiturgyText } from '../../components/LiturgyText'
import { AppText } from '../../components/AppText'
import { spacing } from '../../design/tokens'
import { useI18n } from '../i18n'
import { currentPart } from '../live/contracts'
import { useReader } from '../live/useReader'
import { lifecycle } from '../live/lifecycle'
import { ControlConnectionStatus } from '../live/ConnectionStatus'
import type { DisplayLanguage, DisplayLinkConfig } from './config'
import type { Endpoints } from '../live/config'

/**
 * The display contract accepts a fourth interface language (`hyw`, Western Armenian)
 * that the core reading text does not carry. Map known values and return null for
 * unsupported ones so the screen renders the honest "no text available" message
 * instead of an empty column.
 */
function toCoreLanguage(lang: DisplayLanguage): Language | null {
  if (lang === 'hyw') return null
  // TypeScript narrows `lang` to the remaining four values here.
  return lang
}

export interface DisplayProjectionProps {
  apiBase: string
  cableBase: string
  config: DisplayLinkConfig
  sessionId: number
}

/**
 * Renders a single service at projection scale: a header (church and liturgy),
 * the current part's text in the configured language, and the shared connection
 * status widget. Operator interrupts and parallel columns land in follow-up PRs.
 */
export function DisplayProjection({ apiBase, cableBase, config, sessionId }: DisplayProjectionProps) {
  const { t } = useI18n()
  const endpoints = useMemo<Endpoints>(() => ({ api: apiBase, cable: cableBase }), [apiBase, cableBase])
  // The display is the live feed, not a saved copy; explanations are deferred to a later PR.
  const { state } = useReader(endpoints, sessionId, false)
  const [online, setOnline] = useState(true)
  useEffect(() => lifecycle.listen((_active, connected) => { setOnline(current => current === connected ? current : connected) }), [])

  const part = state.session ? currentPart(state.session, state.parts) : undefined
  const church = state.session?.church ?? config.church_name ?? ''
  const title = state.session?.title ?? config.title ?? ''
  const language = toCoreLanguage(config.lang1)
  const text = language !== null && part ? part.text[language] : null

  if (!state.session && state.error) {
    return <View testID="display-projection-unavailable" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm }}>
      <AppText variant="title">{t('display.projectionUnavailable')}</AppText>
    </View>
  }

  return <ScrollView testID="display-projection" contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, flexGrow: 1, justifyContent: 'center' }}>
    <View testID="display-projection-header" style={{ gap: spacing.sm }}>
      <AppText variant="eyebrow" tone="muted">{church}</AppText>
      <AppText variant="title">{title}</AppText>
      <ControlConnectionStatus state={state} offline={!online} sending={false} />
    </View>
    {part && <View testID="display-projection-text" style={{ gap: spacing.md }}>
      <AppText variant="eyebrow" tone="muted">{part.role}{typeof part.position === 'number' ? ` · ${part.position}` : ''}</AppText>
      {language !== null && text !== null
        ? <LiturgyText text={text} language={language} />
        : <AppText tone="muted">{t('display.projectionNoText')}</AppText>}
    </View>}
  </ScrollView>
}
