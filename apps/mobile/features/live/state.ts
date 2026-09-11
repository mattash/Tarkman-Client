import type { LiveExplanation, LivePart, LiveSession } from './contracts'
export interface ReaderState {
  services: LiveSession[]; session: LiveSession | null; parts: LivePart[]; explanations: LiveExplanation[]
  loading: boolean; refreshing: boolean; error: string | null; explanationError: boolean
  stale: boolean; connected: boolean; listed: boolean; following: boolean; updatedAt: number | null
}
export const initialState: ReaderState = { services: [], session: null, parts: [], explanations: [], loading: true, refreshing: false,
  error: null, explanationError: false, stale: true, connected: false, listed: true, following: true, updatedAt: null }
export type ReaderAction = { type: 'manual' | 'follow' | 'refresh' | 'stale' } | { type: 'connection'; connected: boolean }
  | { type: 'failure'; message: string } | { type: 'recovered'; snapshot: Pick<ReaderState, 'services' | 'session' | 'parts' | 'explanations' | 'explanationError' | 'listed'>; now: number }
export function readerReducer(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case 'manual': return { ...state, following: false }
    case 'follow': return { ...state, following: true }
    case 'refresh': return { ...state, refreshing: true }
    case 'stale': return { ...state, stale: true, explanations: [] }
    case 'connection': return { ...state, connected: action.connected, stale: action.connected ? state.stale : true }
    case 'failure': return { ...state, loading: false, refreshing: false, stale: true, error: action.message, explanations: [] }
    case 'recovered': return { ...state, ...action.snapshot, loading: false, refreshing: false, error: null, stale: false, updatedAt: action.now }
  }
}
