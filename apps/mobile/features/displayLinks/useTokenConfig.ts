import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { createCable } from '../live/cable'
import type { Endpoints } from '../live/config'
import { lifecycle } from '../live/lifecycle'
import { fetchDisplayLink } from './api'
import { createConfigController } from './configController'

export function useTokenConfig(endpoints: Endpoints, token: string, request: typeof fetch) {
  const controller = useMemo(() => createConfigController(token,
    signal => fetchDisplayLink(endpoints.api, token, request, signal), createCable(), endpoints.cable, lifecycle),
  [endpoints.api, endpoints.cable, token, request])
  useEffect(() => controller.start(), [controller])
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
}
