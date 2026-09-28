import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { AppButton } from '../../../components/AppButton'
import { AppModal } from '../../../components/AppModal'
import { AppText } from '../../../components/AppText'
import { Notice } from '../../../components/Notice'
import { Card } from '../../../components/Surface'
import { useAuth } from '../../auth/AuthProvider'
import { useI18n } from '../../i18n'
import { readerConfig } from '../../live/config'
import { createCatalogController } from './catalog'
import { createCreationController, isDirty } from './creation'
import { todayIn } from './draft'
import { FormShell } from './FormShell'
import { announceMutation, managementScope } from './mutations'
import { SessionForm } from './SessionForm'

/** Auth hydration is owned by the signed-in layout; the key isolates every draft to one environment and account. */
export function NewSessionRoute() {
  const auth = useAuth(), api = readerConfig().endpoints?.api
  if (auth.state.status !== 'signedIn') return null
  return <NewSession key={managementScope(api, auth.state.user.id)} scope={managementScope(api, auth.state.user.id)} />
}

export function leaveToMySessions() {
  if (router.canGoBack()) router.back()
  else router.replace('/services')
}

function NewSession({ scope }: { scope: string }) {
  const { authorizedFetch } = useAuth()
  const { t } = useI18n()
  const controller = useMemo(() => createCreationController(authorizedFetch), [authorizedFetch])
  const catalog = useMemo(() => createCatalogController(authorizedFetch), [authorizedFetch])
  useEffect(() => () => { controller.dispose(); catalog.dispose() }, [controller, catalog])
  useFocusEffect(controller.focus)
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const [confirmToday, setConfirmToday] = useState(false)
  // Choosing to check My Sessions after an unknown outcome is deliberate, so it skips the discard prompt.
  const [checking, setChecking] = useState(false)
  const announced = useRef(false)
  const createRef = useRef<View>(null)
  const { bootstrap, phase } = state
  const editable = !!bootstrap && phase === 'editing'
  const guarded = !checking && ((isDirty(state) && phase !== 'created') || phase === 'pending' || phase === 'uncertain')

  useEffect(() => {
    if (phase !== 'created' || !state.created || announced.current) return
    announced.current = true
    const session = state.created
    announceMutation({ kind: 'created', scope, replayed: state.replayed, session: { id: session.id, title: session.title, date: session.date } })
    leaveToMySessions()
  }, [phase, state.created, state.replayed, scope])
  useEffect(() => { if (checking) leaveToMySessions() }, [checking])

  function create() {
    // A today-dated session asks first; submit() validates, so an invalid draft never reaches the dialog.
    if (bootstrap && state.draft.date === todayIn(bootstrap.timeZone, bootstrap.defaultDate) && controller.validate()) setConfirmToday(true)
    else controller.submit()
  }

  const footer = bootstrap && phase !== 'expired' ? <>
    {phase === 'uncertain'
      ? <><AppText variant="caption" tone="muted">{t('sessionManagement.retrySafelyHelp')}</AppText>
        <AppButton size="hero" onPress={controller.retrySafely}>{t('sessionManagement.retrySafely')}</AppButton>
        <AppButton variant="text" onPress={() => setChecking(true)}>{t('sessionManagement.checkList')}</AppButton></>
      : <AppButton ref={createRef} size="hero" loading={phase === 'pending'} disabled={!editable} onPress={create}>{t('sessionManagement.create')}</AppButton>}
  </> : undefined

  return <FormShell title={t('sessionManagement.newTitle')} intro={t('sessionManagement.intro')} guarded={guarded}
    error={state.error} otherErrors={state.otherErrors} onCancel={leaveToMySessions} footer={footer}>
    {!bootstrap && state.bootstrapLoading && <ActivityIndicator accessibilityLabel={t('sessionManagement.preparing')} />}
    {!bootstrap && state.bootstrapError && <Card>
      <AppText accessibilityRole="alert">{state.bootstrapError}</AppText>
      {state.unavailable
        ? <AppButton variant="secondary" onPress={leaveToMySessions}>{t('common.myServices')}</AppButton>
        : <AppButton variant="secondary" onPress={() => void controller.retryBootstrap()}>{t('common.retry')}</AppButton>}
    </Card>}
    {phase === 'expired' && <Card><AppButton onPress={() => setChecking(true)}>{t('sessionManagement.checkList')}</AppButton></Card>}
    {bootstrap && <>
      <Notice tone="neutral">{t('sessionManagement.publicNote')}</Notice>
      <SessionForm draft={state.draft} timeZone={bootstrap.timeZone} editable={editable} fields={state.fields} focusRequest={state.focusRequest}
        catalog={catalog} onDate={controller.setDate} onOption={controller.setOption} onChange={controller.update} />
    </>}
    <AppModal visible={confirmToday} onDismiss={() => setConfirmToday(false)} title={t('sessionManagement.todayTitle')} openerRef={createRef}>
      <AppText>{t('sessionManagement.todayBody')}</AppText>
      <AppButton onPress={() => { setConfirmToday(false); controller.submit() }}>{t('sessionManagement.create')}</AppButton>
      <AppButton variant="secondary" onPress={() => setConfirmToday(false)}>{t('common.cancel')}</AppButton>
    </AppModal>
  </FormShell>
}
