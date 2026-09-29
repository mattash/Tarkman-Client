import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { createPolledResource } from '@tarkman/reader'
import { lifecycle } from '../live/lifecycle'

/** Serial, bounded polling; identity changes discard old results before the next effect. */
export function useDisplayResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>, interval: number) {
  // The key only names the resource: a new one gets a new controller, so an old result can never land.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const controller = useMemo(() => createPolledResource(load, interval, lifecycle), [key, load, interval])
  useEffect(() => controller.start(), [controller])
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
}
