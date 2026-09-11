import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { createApi } from './api'
import { createCable } from './cable'
import type { Endpoints } from './config'
import { createReaderController } from './controller'
import { lifecycle } from './lifecycle'
export function useReader(endpoints: Endpoints, id: number | null) {
  const controller = useMemo(() => createReaderController(createApi(endpoints.api), createCable(), endpoints.cable, lifecycle, id), [endpoints.api, endpoints.cable, id])
  useEffect(() => controller.start(), [controller])
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return { state, retry: controller.retry, dispatch: controller.dispatch }
}
