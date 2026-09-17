import { useSavedService } from '../offline/useSavedService'
import { saveSavedService } from '../offline/savedServiceStore'
import { benchmarkMark, benchmarkContext } from '../observability/latencyBenchmark'
import { currentPart } from './contracts'
import { useLayoutEffect, useEffect, useMemo, useSyncExternalStore } from 'react'
import { createApi } from './api'
import { createCable } from './cable'
import type { Endpoints } from './config'
import { createReaderController } from './controller'
import { lifecycle } from './lifecycle'
export function useReader(endpoints: Endpoints, id: number | null) {
  const controller = useMemo(() => createReaderController(createApi(endpoints.api), createCable(), endpoints.cable, lifecycle, id, id === null ? undefined : { save: saveSavedService }), [endpoints.api, endpoints.cable, id])
  useEffect(() => controller.start(), [controller])
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  useLayoutEffect(() => {
    const trace = benchmarkContext(id)
    if (!trace) return
    const part = state.session ? currentPart(state.session, state.parts) : undefined
    benchmarkMark('ui.commit', { part_key: part?.key, part_id: state.session?.currentPartId,
      position: state.session?.currentPosition, refreshing: state.refreshing, stale: state.stale,
      connected: state.connected, following: state.following, failed: !!state.error }, trace)
  }, [id, state])
  const saved = useSavedService(id)
  return { saved, state, retry: controller.retry, dispatch: controller.dispatch }
}
