import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { AppButton } from '../../../components/AppButton'
import { AppModal } from '../../../components/AppModal'
import { AppText } from '../../../components/AppText'
import { Notice } from '../../../components/Notice'
import { Card } from '../../../components/Surface'
import { spacing } from '../../../design/tokens'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import { readerConfig } from '../../live/config'
import { formatServiceDate } from '../api'
import { createCatalogController } from './catalog'
import { OPTION_KEYS, setupDiff, setupOf, type ManagedSession } from './contracts'
import { createDeletionController } from './deletion'
import { DeleteSessionDialog } from './DeleteSessionDialog'
import { type SessionDraft } from './draft'
import { useManagementToday } from './zone'
import { createEditController, draftOf, isEditDirty, pendingChanges } from './editing'
import { draftSetup } from './draft'
import { FormShell } from './FormShell'
import { announceMutation, managementScope } from './mutations'
import { leaveToMySessions } from './NewSession'
import { SessionForm } from './SessionForm'

/** Validates the route ID, then keys the editor by environment, account, and session. */
export function EditSessionRoute({ id }: { id: string | undefined }) {
  const auth = useAuth(), api = readerConfig().endpoints?.api
  const { t } = useI18n()
  const sessionId = typeof id === 'string' && /^[1-9]\d*$/.test(id) ? Number(id) : null
  if (auth.state.status !== 'signedIn') return null
  if (sessionId === null || !Number.isSafeInteger(sessionId)) {
    return <FormShell title={t('sessionManagement.editTitle')} guarded={false} error={t('common.serviceLinkInvalid')} onCancel={leaveToMySessions}>
      <AppButton variant="secondary" onPress={leaveToMySessions}>{t('common.myServices')}</AppButton>
    </FormShell>
  }
  const scope = managementScope(api, auth.state.user.id)
  return <EditSession key={`${scope}\n${sessionId}`} scope={scope} userId={auth.state.user.id} sessionId={sessionId} />
}

function EditSession({ scope, userId, sessionId }: { scope: string; userId: number; sessionId: number }) {
  const { authorizedFetch } = useAuth()
  const { t } = useI18n()
  const controller = useMemo(() => createEditController(authorizedFetch, sessionId), [authorizedFetch, sessionId])
  const catalog = useMemo(() => createCatalogController(authorizedFetch), [authorizedFetch])
  const deletion = useMemo(() => createDeletionController(authorizedFetch), [authorizedFetch])
  useEffect(() => () => { controller.dispose(); catalog.dispose(); deletion.dispose() }, [controller, catalog, deletion])
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  // Loads on focus; a dirty draft is never overwritten by the refetch.
  useFocusEffect(useMemo(() => () => { void controller.load() }, [controller]))
  const [leaving, setLeaving] = useState(false)
  const announced = useRef(false)
  const deleteRef = useRef<View>(null)
  const { baseline, phase } = state
  const dirty = isEditDirty(state)
  const editable = !!baseline && phase === 'editing' && !state.conflict && !state.reset && !state.final
  const guarded = !leaving && (dirty || phase === 'saving' || phase === 'uncertain')

  useEffect(() => {
    if (phase !== 'saved' || !state.committed || announced.current) return
    announced.current = true
    announceMutation({ kind: 'saved', scope, session: { id: state.committed.id, title: state.committed.title, date: state.committed.date } })
    setLeaving(true)
  }, [phase, state.committed, scope])
  useEffect(() => { if (leaving) leaveToMySessions() }, [leaving])

  const today = useManagementToday(authorizedFetch)
  const movesToday = !!baseline && state.draft.date !== baseline.date && (state.draft.date === today || baseline.date === today)
  const changes = pendingChanges(state)

  const footer = baseline && !state.final ? <>
    {phase === 'uncertain'
      ? <AppButton size="hero" loading={state.loading} onPress={controller.reconcile}>{t('sessionManagement.checkAgain')}</AppButton>
      : <AppButton size="hero" loading={phase === 'saving'} disabled={!editable || !changes} onPress={controller.save}>{t('sessionManagement.saveChanges')}</AppButton>}
  </> : undefined

  return <FormShell title={t('sessionManagement.editTitle')} intro={t('sessionManagement.editIntro')} guarded={guarded}
    error={state.error ?? state.loadError} otherErrors={state.otherErrors} onCancel={leaveToMySessions} footer={footer}>
    {!baseline && state.loading && <ActivityIndicator accessibilityLabel={t('sessionManagement.preparing')} />}
    {(state.final || (!baseline && state.loadError)) && <Card>
      {!state.final && <AppButton variant="secondary" onPress={() => void controller.load()}>{t('common.retry')}</AppButton>}
      <AppButton variant="secondary" onPress={leaveToMySessions}>{t('common.myServices')}</AppButton>
    </Card>}
    {state.conflict && baseline && <Card testID="edit-conflict">
      <AppText variant="heading" accessibilityRole="alert">{t(state.conflictReason === 'unconfirmed' ? 'sessionManagement.unconfirmedTitle' : 'sessionManagement.conflictTitle')}</AppText>
      <AppText>{t(state.conflictReason === 'unconfirmed' ? 'sessionManagement.unconfirmedBody' : 'sessionManagement.conflictBody')}</AppText>
      <ConflictSummary base={baseline} saved={state.conflict} draft={state.draft} />
      <AppButton onPress={controller.reapply}>{t('sessionManagement.reapply')}</AppButton>
      <AppButton variant="secondaryDestructive" onPress={controller.reloadSaved}>{t('sessionManagement.reloadSaved')}</AppButton>
    </Card>}
    {baseline && !state.final && <>
      {movesToday && <Notice tone="neutral">{t('sessionManagement.dateMovesToday')}</Notice>}
      <SessionForm draft={state.draft} timeZone={null} editable={editable} fields={state.fields} focusRequest={state.focusRequest}
        catalog={catalog} onDate={controller.setDate} onOption={controller.setOption} onChange={controller.update} />
      <Card>
        <AppText variant="heading">{t('sessionManagement.deleteTitle')}</AppText>
        <AppText tone="muted">{t('sessionManagement.deleteHelp')}</AppText>
        <View style={{ alignSelf: 'flex-start' }}>
          <AppButton ref={deleteRef} variant="secondaryDestructive" disabled={phase === 'saving' || phase === 'uncertain'}
            accessibilityLabel={t('sessionManagement.deleteLabel', { title: baseline.title, date: formatServiceDate(baseline.date) ?? baseline.date })}
            onPress={() => deletion.prepare(sessionId)}>{t('sessionManagement.deleteAction')}</AppButton>
        </View>
      </Card>
    </>}
    <AppModal visible={!!state.reset} onDismiss={controller.cancelReset} title={t('sessionManagement.resetTitle')} dismissLabel={t('common.cancel')}>
      <AppText>{t('sessionManagement.resetBody')}</AppText>
      {state.reset?.destination && <AppText variant="label">{t('sessionManagement.resetDestination', { destination: state.reset.destination })}</AppText>}
      <AppButton variant="secondary" size="form" onPress={controller.cancelReset}>{t('sessionManagement.reviseSelection')}</AppButton>
      <AppButton variant="destructive" size="form" onPress={controller.confirmReset}>{t('sessionManagement.saveAndReset')}</AppButton>
    </AppModal>
    <DeleteSessionDialog controller={deletion} scope={scope} userId={userId} fallbackTitle={baseline?.title} discardsChanges={dirty} openerRef={deleteRef}
      onFinished={() => setLeaving(true)} />
  </FormShell>
}

/** Only the fields this person changed: what is saved now beside their change. Others' edits are not "yours". */
function ConflictSummary({ base, saved, draft }: { base: ManagedSession; saved: ManagedSession; draft: SessionDraft }) {
  const { t } = useI18n()
  const current = draftOf(saved)
  const mine = setupDiff(setupOf(base), draftSetup(draft)) ?? {}
  const rows: [string, string, string][] = []
  if (mine.date !== undefined) rows.push([t('sessionManagement.date'), formatServiceDate(current.date) ?? current.date, formatServiceDate(draft.date) ?? draft.date])
  const names = (list: typeof draft.liturgies) => list.map(item => item.name).join(' · ')
  if (mine.liturgy_ids) rows.push([t('sessionManagement.selected'), names(current.liturgies), names(draft.liturgies)])
  for (const key of OPTION_KEYS) if (mine.options && key in mine.options) rows.push([t(`sessionManagement.${key}`), current.options[key], draft.options[key]])
  return <View style={{ gap: spacing.sm }}>
    {rows.map(([label, now, mine]) => <View key={label} style={{ gap: 2 }}>
      <AppText variant="label">{label}</AppText>
      <AppText>{t('sessionManagement.savedValue', { value: now || '—' })}</AppText>
      <AppText tone="accent">{t('sessionManagement.yourValue', { value: mine || '—' })}</AppText>
    </View>)}
  </View>
}
