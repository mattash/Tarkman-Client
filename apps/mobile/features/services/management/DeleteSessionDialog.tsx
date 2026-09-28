import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { AppButton } from '../../../components/AppButton'
import { AppModal } from '../../../components/AppModal'
import { AppText } from '../../../components/AppText'
import { Notice } from '../../../components/Notice'
import { useI18n } from '../../i18n'
import { forgetLastReading } from '../../progress/lastReading'
import { forgetRecentlyControlled } from '../../progress/recentlyControlled'
import { formatServiceDate } from '../api'
import type { DeletionController } from './deletion'
import { todayIn } from './draft'
import { announceMutation } from './mutations'

export interface DeleteSessionDialogProps {
  controller: DeletionController
  scope: string
  userId: number
  /** The session's title as the list knew it, used if the snapshot is unavailable. */
  fallbackTitle?: string
  /** Deleting from a dirty editor discards its unsaved changes; say so. */
  discardsChanges?: boolean
  openerRef?: RefObject<View | null>
  /** Called once the deletion is confirmed or the session is found already gone. */
  onFinished(outcome: 'deleted' | 'gone'): void
}

/** The only path to DELETE: a fresh snapshot, a confirmation naming the exact session and date, Cancel as the safe default. */
export function DeleteSessionDialog({ controller, scope, userId, fallbackTitle, discardsChanges, openerRef, onFinished }: DeleteSessionDialogProps) {
  const { t } = useI18n()
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const finished = useRef<number | null>(null)
  const { phase, target } = state
  useEffect(() => {
    if ((phase !== 'deleted' && phase !== 'gone') || state.sessionId === null || finished.current === state.sessionId) return
    finished.current = state.sessionId
    const session = { id: state.sessionId, title: target?.title ?? fallbackTitle ?? '', date: target?.date ?? null }
    void forgetRecentlyControlled(session.id, userId)
    void forgetLastReading(session.id)
    announceMutation({ kind: phase === 'deleted' ? 'deleted' : 'unavailable', scope, session })
    controller.reset()
    onFinished(phase)
  }, [phase, state.sessionId, target, fallbackTitle, scope, userId, controller, onFinished])

  const visible = phase === 'preparing' || phase === 'confirming' || phase === 'deleting' || phase === 'unknown' || (phase === 'idle' && !!state.error)
  const date = target ? formatServiceDate(target.date) ?? target.date : null
  const today = !!target && target.date === todayIn(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', '')
  return <AppModal visible={visible} onDismiss={controller.cancel} title={t('sessionManagement.deleteTitle')} dismissLabel={t('common.cancel')} openerRef={openerRef}>
    {phase === 'preparing' && <ActivityIndicator accessibilityLabel={t('sessionManagement.deletePreparing')} />}
    {state.error && <AppText tone={phase === 'confirming' ? 'default' : 'destructive'} accessibilityRole="alert">{state.error}</AppText>}
    {target && (phase === 'confirming' || phase === 'deleting') && <>
      <AppText variant="heading">{t('sessionManagement.deleteName', { title: target.title, date: date ?? '' })}</AppText>
      <AppText>{t('sessionManagement.deleteBody')}</AppText>
      {today && <Notice tone="danger">{t('sessionManagement.deleteToday')}</Notice>}
      {discardsChanges && <Notice tone="neutral">{t('sessionManagement.deleteDiscards')}</Notice>}
      <AppButton variant="secondary" size="form" disabled={phase === 'deleting'} onPress={controller.cancel}>{t('common.cancel')}</AppButton>
      <AppButton variant="destructive" size="form" loading={phase === 'deleting'} accessibilityLabel={t('sessionManagement.deleteConfirmLabel', { title: target.title, date: date ?? '' })}
        onPress={controller.confirm}>{t('sessionManagement.deleteConfirm')}</AppButton>
    </>}
    {phase === 'unknown' && <AppButton variant="secondary" onPress={controller.recheck}>{t('sessionManagement.checkAgain')}</AppButton>}
  </AppModal>
}
