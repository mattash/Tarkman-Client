import type { LiveExplanation, LivePart, LiveSession } from './contracts'
export interface ExplanationProvenance {
  ownerKey: string | null; contextKey: string | null; requestId: number
  status: 'idle' | 'loading' | 'ready' | 'revalidating' | 'invalid' | 'error'
}
const idle: ExplanationProvenance = { ownerKey: null, contextKey: null, requestId: 0, status: 'idle' }
export interface ReaderState {
  services: LiveSession[]; session: LiveSession | null; parts: LivePart[]; explanations: LiveExplanation[]
  explanationProvenance: ExplanationProvenance
  loading: boolean; refreshing: boolean; error: string | null; explanationError: boolean; explanationsLoading: boolean
  stale: boolean; connected: boolean; listed: boolean; following: boolean; updatedAt: number | null
}
export const initialState: ReaderState = { services: [], session: null, parts: [], explanations: [], explanationProvenance: idle, loading: true, refreshing: false,
  error: null, explanationError: false, explanationsLoading: false, stale: true, connected: false, listed: true, following: true, updatedAt: null }
export type ReaderAction = { type: 'manual' | 'follow' | 'refresh' | 'stale' } | { type: 'connection'; connected: boolean }
  | { type: 'explanationReset'; status: 'idle' | 'invalid' }
  | { type: 'explanationStart'; ownerKey: string; contextKey: string | null; requestId: number }
  | { type: 'explanations'; explanations: LiveExplanation[]; failed: boolean; ownerKey: string; requestId: number }
  | { type: 'failure'; message: string } | { type: 'recovered'; provenance?: ExplanationProvenance; explanationsLoading?: boolean; snapshot: Pick<ReaderState, 'services' | 'session' | 'parts' | 'explanations' | 'explanationError' | 'listed'>; now: number }
function clearProof(state: ReaderState, status: 'idle' | 'invalid') {
  return { explanations: [], explanationError: false, explanationsLoading: false,
    explanationProvenance: { ...idle, requestId: state.explanationProvenance.requestId + 1, status: status === 'invalid' && state.explanationProvenance.status === 'idle' ? 'idle' as const : status } }
}
export function canRetainExplanations(state: ReaderState, owner: string | null, context: string | null): boolean {
  const proof = state.explanationProvenance
  return !!owner && context !== null && proof.ownerKey === owner && proof.contextKey === context &&
    (proof.status === 'ready' || proof.status === 'revalidating') && state.connected && !state.stale && !state.error &&
    state.listed && state.session?.status === 'active'
}
export function readerReducer(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case 'manual': return { ...state, following: false }
    case 'follow': return { ...state, following: true }
    case 'refresh': {
      const proof = state.explanationProvenance
      const retain = canRetainExplanations(state, proof.ownerKey, proof.contextKey)
      return { ...state, ...(retain ? { explanationProvenance: { ...proof, requestId: proof.requestId + 1, status: 'revalidating' as const }, explanationsLoading: false } : clearProof(state, 'invalid')), refreshing: true }
    }
    case 'explanationReset': return { ...state, ...clearProof(state, action.status) }
    case 'stale': return { ...state, ...clearProof(state, 'invalid'), stale: true }
    case 'connection': return { ...state, ...(!action.connected ? clearProof(state, 'invalid') : {}), connected: action.connected, stale: action.connected ? state.stale : true }
    case 'failure': return { ...state, ...clearProof(state, 'invalid'), loading: false, refreshing: false, stale: true, error: action.message }
    case 'explanationStart': {
      const retain = canRetainExplanations(state, action.ownerKey, action.contextKey)
      return { ...state, explanations: retain ? state.explanations : [], explanationError: false, explanationsLoading: !retain,
        explanationProvenance: { ownerKey: action.ownerKey, contextKey: action.contextKey, requestId: action.requestId, status: retain ? 'revalidating' : 'loading' } }
    }
    case 'explanations':
      if (action.ownerKey !== state.explanationProvenance.ownerKey || action.requestId !== state.explanationProvenance.requestId || !['loading', 'revalidating'].includes(state.explanationProvenance.status)) return state
      return { ...state, explanations: action.failed ? [] : action.explanations, explanationError: action.failed, explanationsLoading: false,
        explanationProvenance: { ...state.explanationProvenance, status: action.failed ? 'error' : 'ready' } }
    case 'recovered': return { ...state, ...action.snapshot, explanationProvenance: action.provenance ?? { ...idle, requestId: state.explanationProvenance.requestId + 1 }, explanationsLoading: action.explanationsLoading ?? false, loading: false, refreshing: false, error: null, stale: false, updatedAt: action.now }
  }
}
