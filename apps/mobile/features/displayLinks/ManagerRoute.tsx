import { useMemo, useSyncExternalStore } from 'react'
import { useFocusEffect } from 'expo-router'
import { useAuth } from '../auth/AuthProvider'
import { readerConfig } from '../live/config'
import { createManagementApi } from './managementApi'
import { createManagementController } from './managementController'
import { LinkList } from './LinkList'
import { LinkEditor } from './LinkEditor'

/** Auth hydration is owned by the signed-in layout. Key isolates both account and environment. */
export function ManagerRoute({ token }: { token?: string | null }) {
  const auth = useAuth(), api = readerConfig().endpoints?.api
  if (auth.state.status !== 'signedIn' || !api) return null
  return <ScopedManager key={`${api}/${auth.state.user.id}/${token ?? ''}/${token === null}`} token={token} />
}
function ScopedManager({ token }: { token?: string | null }) {
  const { authorizedFetch } = useAuth()
  const controller = useMemo(() => createManagementController(createManagementApi(authorizedFetch), token), [authorizedFetch, token])
  useFocusEffect(controller.start)
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return token === undefined ? <LinkList state={state} controller={controller} /> : <LinkEditor state={state} controller={controller} />
}
export type ManagerController = ReturnType<typeof createManagementController>
export type ManagerSnapshot = ReturnType<ManagerController['getSnapshot']>
