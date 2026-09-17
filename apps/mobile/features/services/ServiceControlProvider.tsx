import { benchmarkMark, benchmarkContext } from '../observability/latencyBenchmark'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { capitalized } from '../../components/PartHeading'
import { useAuth } from '../auth/AuthProvider'
import { readerConfig } from '../live/config'
import { currentPart, type LivePart } from '../live/contracts'
import type { ReaderState } from '../live/state'
import { useReader } from '../live/useReader'
import { createServiceControls, type ServiceControls } from './controls'
import { useControls } from './useControls'
import { t } from '../i18n'

export const STOP_ANNOUNCEMENT = 'stop-announcement'

export interface ServiceControlValue {
  sessionId: number
  /** Null when the link or configuration is usable; otherwise the message to show instead of controls. */
  invalid: string | null
  state: ReaderState
  retry(): void
  controls: ReturnType<typeof useControls>
  commands: ServiceControls
  part: LivePart | undefined
  index: number
  nextPart: LivePart | undefined
  previousPart: LivePart | undefined
  offline: boolean
  announcing: boolean
  /** The part this device is showing, sent so the server can refuse a move that is already out of date. */
  expected: number | null
  /** Runs one command; resolves true only when the server accepted it. */
  run(name: string, command: () => Promise<void>): Promise<boolean>
  /** Spinner for the pressed control; 56% for every other one while a command runs or the device is offline. */
  holds(name: string): { sending: boolean; held: boolean }
  /** The failure message, naming where the service is once a refused stale move has resynced. */
  errorMessage: string | null
  sheetOpen: boolean
  setSheetOpen(open: boolean): void
}

const ServiceControlContext = createContext<ServiceControlValue | null>(null)

/**
 * One reader connection and one command runner for a service, shared by the control screen and its Service sheet.
 * The sheet is its own route so it can use native detents, so this state lives above both.
 */
export function ServiceControlProvider({ sessionId, children }: { sessionId: number; children: ReactNode }) {
  const { authorizedFetch } = useAuth()
  const config = readerConfig()
  const valid = Number.isInteger(sessionId) && sessionId > 0
  const { state, retry } = useReader(config.endpoints ?? { api: '', cable: '' }, valid ? sessionId : null)
  const controls = useControls(retry)
  const [sheetOpen, setSheetOpen] = useState(false)
  // The snapshot a command was sent against, so a refused move names where the service is only once the screen has caught up.
  const [sentAgainst, setSentAgainst] = useState<number | null>(null)
  const part = state.session ? currentPart(state.session, state.parts) : undefined
  const index = part ? state.parts.findIndex(item => item.key === part.key) : -1
  const offline = !controls.online
  const resynced = state.updatedAt !== sentAgainst && !state.refreshing
  const value: ServiceControlValue = {
    sessionId,
    invalid: !config.endpoints ? config.error ?? t('control.cannotOpen') : valid ? null : t('common.serviceLinkInvalid'),
    state, retry, controls,
    commands: createServiceControls(authorizedFetch),
    part, index,
    nextPart: index >= 0 ? state.parts[index + 1] : undefined,
    previousPart: index > 0 ? state.parts[index - 1] : undefined,
    offline,
    announcing: state.session?.status === 'showing_custom',
    expected: part?.id ?? null,
    run: (name, command) => {
      benchmarkMark('control.tap', { direction: name, expected_part_id: part?.id }, benchmarkContext(sessionId))
      setSentAgainst(state.updatedAt)
      return controls.run(name, command)
    },
    holds: name => ({ sending: controls.running === name, held: offline || (controls.running !== null && controls.running !== name) }),
    errorMessage: controls.failure === 'stale' && resynced && part
      ? `${controls.error} It is now at ${part.position} · ${capitalized(part.role)}.` : controls.error,
    sheetOpen, setSheetOpen,
  }
  return <ServiceControlContext.Provider value={value}>{children}</ServiceControlContext.Provider>
}

export function useServiceControl(): ServiceControlValue {
  const context = useContext(ServiceControlContext)
  if (!context) throw new Error('useServiceControl must be used within a ServiceControlProvider')
  return context
}
