import { useState } from 'react'
import { View } from 'react-native'
import { AppButton } from '../../components/AppButton'
import { AppText } from '../../components/AppText'
import { spacing } from '../../design/tokens'
import { sampleLanguages } from '../../design/samples'
import { parseMarkdownSource } from '../../design/markdownSource'
import { useI18n } from '../i18n'
import type { Bundle } from './contracts'
import type { PassageAnchor, ReadingMetadata } from './readingMetadata'
import { resolveTextJump } from './textFind'
import { canOpenSavedPassage } from './savedPassage'

export function SavedPassages({ bundle, metadata, ready, position, storageFailed, capacity, save, remove, clearResume, open }: {
  bundle: Bundle | undefined; metadata: ReadingMetadata; ready: boolean; position: PassageAnchor | null; storageFailed: boolean; capacity: boolean
  save(): Promise<void> | null; remove(anchor: PassageAnchor): Promise<void>; clearResume(): Promise<void>; open(anchor: PassageAnchor): void
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const run = async (action: () => Promise<void> | null) => {
    setBusy(true)
    try { await action() } finally { setBusy(false) }
  }
  return <View testID="library-saved-passages" style={{ gap: spacing.md }}>
    <AppText variant="caption" tone="muted">{t('library.savedPassagesHelp')}</AppText>
    {!ready ? <AppText>{t('library.positionLoading')}</AppText> : <>
      <AppButton disabled={!position || busy || capacity} onPress={() => { void run(save) }}>{t('library.savePassage')}</AppButton>
      {!position && <AppText variant="caption">{t('library.positionWaiting')}</AppText>}
      {metadata.resume && <View style={{ gap: spacing.sm }}>
        <AppButton variant="secondary" disabled={busy || !(bundle && canOpenSavedPassage(bundle, metadata.resume))} onPress={() => open(metadata.resume!)}>{t('library.resumeReading')}</AppButton>
        {!(bundle && canOpenSavedPassage(bundle, metadata.resume)) && <AppText variant="caption">{t('library.readingPositionUnavailable')}</AppText>}
        <AppButton variant="quiet" disabled={busy} onPress={() => { void run(clearResume) }}>{t('library.clearPosition')}</AppButton>
      </View>}
      {!metadata.bookmarks.length && <AppText tone="muted">{t('library.savedPassagesEmpty')}</AppText>}
      {metadata.bookmarks.map((anchor, index) => {
        const resolved = bundle && canOpenSavedPassage(bundle, anchor) ? resolveTextJump(bundle, anchor) : null
        // Display context comes only from the currently open bundle; it is never persisted with the anchor.
        const text = resolved && bundle ? bundle.parts[resolved.occurrenceIndex].text[anchor.language]!.slice(resolved.start, resolved.end) : ''
        const excerpt = parseMarkdownSource(text).runs.map(run => run.text).join('').replace(/\s+/g, ' ').slice(0, 160)
        return <View key={JSON.stringify(anchor)} style={{ gap: spacing.xs, paddingVertical: spacing.sm }}>
          <AppButton variant="secondary" disabled={busy || !resolved} onPress={() => open(anchor)}>{t('library.savedPassage', { number: index + 1,
            language: sampleLanguages.find(language => language.value === anchor.language)?.label ?? anchor.language })}</AppButton>
          <AppText variant="caption" tone="muted">{resolved ? excerpt : t('library.passageUnavailable')}</AppText>
          <AppButton variant="quiet" disabled={busy} onPress={() => { void run(() => remove(anchor)) }}>{t('library.removePassage', { number: index + 1 })}</AppButton>
        </View>
      })}
    </>}
    {capacity && <AppText accessibilityRole="alert">{t('library.positionCapacity')}</AppText>}
    {storageFailed && <AppText accessibilityRole="alert">{t('library.positionStorageFailed')}</AppText>}
  </View>
}
