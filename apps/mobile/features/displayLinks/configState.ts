import type { PublicDisplayLink } from '@tarkman/core'
import { record } from '../live/contracts'
import { normalizeConfig } from './normalize'
import { normalizeCustomization } from './customization'
import { isDisplayLanguage, isDisplayMode, isDisplayStatusView, type DisplayLinkConfig } from './config'

export interface ConfigState {
  data?: DisplayLinkConfig
  version: number
  terminal?: 'deleted' | 'expired' | 'unavailable'
  error?: Error
}
export const initialConfigState: ConfigState = { version: -1 }
export type ConfigAction =
  | { type: 'snapshot'; config: DisplayLinkConfig; canonical?: boolean }
  | { type: 'invalid'; version: number; reason: NonNullable<ConfigState['terminal']> }
  | { type: 'error'; error: Error }

/** HTTP and cable pass through exactly the same monotonic acceptance rules. */
export function configReducer(state: ConfigState, action: ConfigAction): ConfigState {
  if (action.type === 'error') return { ...state, error: action.error }
  if (action.type === 'invalid') {
    if (state.terminal === 'deleted' || state.terminal === 'unavailable') return state
    if (action.version < state.version || (state.terminal === action.reason && action.version === state.version)) return state
    return { version: action.version, terminal: action.reason }
  }
  const version = action.config.config_version ?? -1
  if (state.terminal && !(state.terminal === 'expired' && action.canonical && (version > state.version || state.version < 0) &&
    (!action.config.expires_at || Date.parse(action.config.expires_at) > Date.now()))) return state
  if (version < state.version || (version === state.version && state.data && version >= 0)) {
    return action.canonical && state.error ? { ...state, error: undefined } : state
  }
  return { data: action.config, version }
}

/** Events must be complete, typed snapshots. Legacy GETs still use tolerant normalization. */
export function completeConfig(value: unknown): PublicDisplayLink | null {
  const raw = record(value), normalized = normalizeConfig(raw)
  if (!normalized || !Number.isSafeInteger(raw.config_version) || Number(raw.config_version) < 0 ||
    !(raw.title === null || typeof raw.title === 'string') || !isDisplayMode(raw.mode) || !isDisplayLanguage(raw.lang1) ||
    !(raw.lang2 === null || isDisplayLanguage(raw.lang2)) || (raw.mode === 'parallel' && raw.lang2 === null) ||
    typeof raw.show_notifications !== 'boolean' || typeof raw.show_explanations !== 'boolean' ||
    !isDisplayStatusView(raw.status_view) || Object.keys(normalizeCustomization(raw)).length !== 5 ||
    !['updated_at'].every(field => typeof raw[field] === 'string' && Number.isFinite(Date.parse(raw[field] as string))) ||
    !(raw.expires_at === null || typeof raw.expires_at === 'string' && Number.isFinite(Date.parse(raw.expires_at)))) return null
  return normalized as PublicDisplayLink
}
