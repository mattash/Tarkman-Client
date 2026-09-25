import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { acknowledgeExplanations, explanationItems, newExplanationCount, sameExplanationBatch, verifiedExplanationOwner,
  type ExplanationBatch, type ExplanationHistory } from './explanationCue'
import type { ReaderState } from './state'

export function useExplanationCue(scope: string, state: ReaderState, eligible: boolean, presentation: object | null) {
  const [store, setStore] = useState(() => ({ scope, token: {}, history: new Map() as ExplanationHistory }))
  // Adjust during render, before children can commit in a different reader scope.
  if (store.scope !== scope) setStore({ scope, token: {}, history: new Map() })
  const owner = eligible && store.scope === scope ? verifiedExplanationOwner(state) : null
  const items = useMemo(() => explanationItems(state.explanations), [state.explanations])
  const batch = useMemo<ExplanationBatch | null>(() => owner && items && state.explanationProvenance.status === 'ready'
    ? Object.freeze({ readerScopeKey: scope, readerInstanceToken: store.token, ownerKey: owner,
      requestId: state.explanationProvenance.requestId, items }) : null,
  [owner, items, scope, store.token, state.explanationProvenance.status, state.explanationProvenance.requestId])
  const guard = useRef<{ batch: ExplanationBatch | null; presentation: object | null }>({ batch: null, presentation: null })
  useLayoutEffect(() => { guard.current = { batch, presentation } })
  useLayoutEffect(() => () => { guard.current = { batch: null, presentation: null } }, [])
  const acknowledgePresented = useCallback((captured: ExplanationBatch, shown: object) => {
    const latest = guard.current
    if (!latest.batch || latest.presentation !== shown || !sameExplanationBatch(captured, latest.batch)) return
    setStore(previous => {
      if (guard.current.presentation !== shown || !guard.current.batch || !sameExplanationBatch(captured, guard.current.batch)) return previous
      if (previous.token !== captured.readerInstanceToken || previous.scope !== captured.readerScopeKey || newExplanationCount(previous.history, captured.ownerKey, captured.items) === 0) return previous
      return { ...previous, history: acknowledgeExplanations(previous.history, captured) }
    })
  }, [])
  const invalidatePresentation = useCallback(() => { guard.current = { batch: null, presentation: null } }, [])
  return { invalidatePresentation, available: !!owner && !!items?.length, newCount: owner && items ? newExplanationCount(store.history, owner, items) : 0, batch, acknowledgePresented }
}
