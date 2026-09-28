import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TVFocusGuideView, View, useTVEventHandler, type View as ViewType } from 'react-native'
import { LANGUAGES } from '@tarkman/core'
import { currentPart, type Endpoints } from '@tarkman/reader'
import { availableLanguages, readingParts, type ReadingBlock, type ReadingPart } from '../blocks'
import { FocusButton } from '../components/FocusButton'
import { FreshnessBadge } from '../components/FreshnessBadge'
import { freshness, isConfirmedLive } from '../freshness'
import { useKeepAwakeWhile, useOnline } from '../hooks'
import { useI18n } from '../i18n'
import { usePreferences } from '../preferences'
import { useReader, type ReaderTransport } from '../reader'
import { colors, readingSize, safe, space, type } from '../theme'

const ORDER = LANGUAGES.map(language => language.value)

interface Props { endpoints: Endpoints; id: number; onBack(): void; transport?: ReaderTransport }

/**
 * Read-only reader that follows the service. Remote Up/Down reads locally and suspends following;
 * the broadcast cursor is only ever read, never written. Return to live (or Play/Pause) resumes.
 */
export function ReaderScreen({ endpoints, id, onBack, transport }: Props) {
  const { t } = useI18n()
  const online = useOnline()
  const { readingLanguage, setReadingLanguage, textSize } = usePreferences()
  const { state, retry, readManually, returnToLive } = useReader(endpoints, id, transport)
  const fresh = freshness(state, online)
  const live = isConfirmedLive(fresh)
  const languages = useMemo(() => availableLanguages(state.parts, ORDER), [state.parts])
  const language = languages.includes(readingLanguage) ? readingLanguage : languages[0]
  const parts = useMemo(() => readingParts(state.parts, language), [state.parts, language])
  const currentKey = state.session ? currentPart(state.session, state.parts)?.key : undefined
  const ongoing = !state.deleted && state.listed

  // A live service keeps the TV awake; an ended or missing one lets it sleep.
  useKeepAwakeWhile(ongoing && !!state.session, 'tarkman-reader')

  const scroll = useRef<ScrollView>(null)
  const partTop = useRef(new Map<string, number>())
  const blockRefs = useRef(new Map<string, ViewType>())
  const [contentFocused, setContentFocused] = useState(false)
  const [layoutVersion, setLayoutVersion] = useState(0)

  // Following: bring the live part into view and, while reading has focus, move focus with it.
  useEffect(() => {
    if (!state.following || !currentKey) return
    const top = partTop.current.get(currentKey)
    if (top !== undefined) scroll.current?.scrollTo({ y: Math.max(0, top - space.lg), animated: true })
    if (contentFocused) blockRefs.current.get(`${currentKey}#0`)?.requestTVFocus?.()
    // contentFocused is read, not tracked: focus moving must not re-scroll.
  }, [state.following, currentKey, layoutVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Play/Pause is the remote's shortcut back to live.
  useTVEventHandler(event => { if (event?.eventType === 'playPause' && !state.following) returnToLive() })

  const onBlockFocus = (block: ReadingBlock) => {
    setContentFocused(true)
    // Programmatic focus always targets the live part, so only the viewer can land elsewhere.
    if (state.following && block.partKey !== currentKey) readManually()
  }

  const header = state.session
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text testID="reader-church" style={styles.church} numberOfLines={1}>{header?.church ?? t('fallbacks.churchService')}</Text>
          <Text style={styles.service} numberOfLines={1}>{header?.title ?? ''}</Text>
        </View>
        <FreshnessBadge value={fresh} />
      </View>

      <TVFocusGuideView autoFocus style={styles.toolbar}>
        {!state.following ? (
          <FocusButton testID="return-to-live" label={t('reader.returnToLive')} variant="primary" hasTVPreferredFocus
            onPress={() => { returnToLive(); setContentFocused(true) }} />
        ) : null}
        {languages.length > 1 ? (
          <View style={styles.languages} accessibilityLabel={t('reader.languages')}>
            {languages.map(value => (
              <FocusButton key={value} testID={`language-${value}`} label={t(`languageNames.${value}`)} selected={value === language}
                onPress={() => setReadingLanguage(value)} onFocus={() => setContentFocused(false)} />
            ))}
          </View>
        ) : null}
        {!live && (fresh.kind === 'stale' || fresh.kind === 'offline' || fresh.kind === 'reconnecting') ? (
          <FocusButton testID="reader-retry" label={t('reader.retry')} onPress={retry} onFocus={() => setContentFocused(false)} />
        ) : null}
        {!ongoing ? <FocusButton testID="reader-back" label={t('reader.backToServices')} hasTVPreferredFocus onPress={onBack} /> : null}
      </TVFocusGuideView>

      {!state.following ? <Text testID="reading-manually" style={styles.manual}>{t('reader.reading')}</Text> : null}

      <ScrollView ref={scroll} style={styles.content} contentContainerStyle={styles.contentInner}>
        {!parts.length ? (
          <Text testID="reader-waiting" style={styles.waiting}>{state.loading ? t('freshness.connecting') : t('reader.waiting')}</Text>
        ) : parts.map(part => (
          <Part key={part.key} part={part} current={part.key === currentKey} dim={!live} size={readingSize[textSize]}
            languageName={t(`languageNames.${language}`)}
            preferred={state.following && part.key === currentKey}
            onLayoutTop={top => { partTop.current.set(part.key, top); if (part.key === currentKey) setLayoutVersion(v => v + 1) }}
            register={(key, view) => { if (view) blockRefs.current.set(key, view); else blockRefs.current.delete(key) }}
            onBlockFocus={onBlockFocus} />
        ))}
      </ScrollView>
    </View>
  )
}

function Part({ part, current, dim, size, languageName, preferred, onLayoutTop, register, onBlockFocus }: {
  part: ReadingPart; current: boolean; dim: boolean; size: number; languageName: string; preferred: boolean
  onLayoutTop(top: number): void; register(key: string, view: ViewType | null): void; onBlockFocus(block: ReadingBlock): void
}) {
  const { t } = useI18n()
  return (
    <View testID={`part-${part.key}`} onLayout={event => onLayoutTop(event.nativeEvent.layout.y)} style={[styles.part, current && styles.currentPart]}>
      <View style={styles.partHeader}>
        {current ? <Text testID="current-marker" style={styles.now}>{t('reader.currentPart')}</Text> : null}
        <Text style={styles.role}>{part.role}</Text>
      </View>
      {part.missing ? (
        <Block testID={`block-${part.key}#0`} text={t('reader.missingLanguage', { language: languageName })} muted size={size} dim={dim}
          preferred={preferred} register={view => register(`${part.key}#0`, view)}
          onFocus={() => onBlockFocus({ key: `${part.key}#0`, partKey: part.key, partIndex: part.index, blockIndex: 0, text: '' })} />
      ) : part.blocks.map((block, index) => (
        <Block key={block.key} testID={`block-${block.key}`} text={block.text} size={size} dim={dim} preferred={preferred && index === 0}
          register={view => register(block.key, view)} onFocus={() => onBlockFocus(block)} />
      ))}
    </View>
  )
}

/** Focusable so the remote can scroll long text; pressing does nothing. Focus is a quiet highlight. */
function Block({ testID, text, size, dim, muted = false, preferred, register, onFocus }: {
  testID: string; text: string; size: number; dim: boolean; muted?: boolean; preferred: boolean
  register(view: ViewType | null): void; onFocus(): void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <Pressable ref={register} testID={testID} hasTVPreferredFocus={preferred} accessibilityRole="text"
      onFocus={() => { setFocused(true); onFocus() }} onBlur={() => setFocused(false)}
      style={[styles.block, focused && styles.blockFocused]}>
      <Text style={[styles.text, { fontSize: size, lineHeight: Math.round(size * 1.4) }, muted && styles.muted, dim && styles.dim]}>{text}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceCanvas, paddingHorizontal: safe.horizontal, paddingTop: safe.vertical },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg },
  titles: { flexShrink: 1 },
  church: { color: colors.textPrimary, fontSize: type.heading, fontWeight: '700' },
  service: { color: colors.textSecondary, fontSize: type.body, marginTop: space.xs },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md, minHeight: 72 },
  languages: { flexDirection: 'row', gap: space.sm },
  manual: { color: colors.warning, fontSize: type.caption, marginTop: space.sm },
  content: { flex: 1, marginTop: space.md },
  contentInner: { paddingBottom: safe.vertical * 4 },
  waiting: { color: colors.textSecondary, fontSize: type.heading, marginTop: space.xl },
  part: { paddingVertical: space.md, paddingHorizontal: space.md, borderLeftWidth: 8, borderLeftColor: 'transparent', marginBottom: space.sm },
  currentPart: { borderLeftColor: colors.actionPrimary, backgroundColor: colors.surfaceDefault },
  partHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xs },
  now: { color: colors.actionOnPrimary, backgroundColor: colors.actionPrimary, fontSize: type.caption, fontWeight: '700', paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  role: { color: colors.textSecondary, fontSize: type.caption, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  block: { paddingVertical: space.xs, paddingHorizontal: space.sm, borderRadius: 12, borderWidth: 3, borderColor: 'transparent' },
  blockFocused: { borderColor: colors.focus, backgroundColor: colors.surfaceRaised },
  text: { color: colors.textPrimary },
  muted: { color: colors.textSecondary, fontStyle: 'italic' },
  dim: { opacity: 0.55 },
})
