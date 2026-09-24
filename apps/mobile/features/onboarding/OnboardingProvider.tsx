import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import type { KeyValueAdapter } from '@tarkman/core'
import { onboardingStore } from './storage'
import { initialOnboarding, ONBOARDING_KEY, readOnboarding, type OnboardingRecord, type Tip } from './state'

type Pending = { sessionId: number | null; restart: boolean } | null
interface Context {
  record: OnboardingRecord; ready: boolean; automatic: boolean; foreground: boolean; sessionUsed: boolean; pending: Pending
  update(patch: Partial<OnboardingRecord> | ((current: OnboardingRecord) => Partial<OnboardingRecord>)): void
  request(restart?: boolean, sessionId?: number): void
  clearPending(): void
  claimTip(tip: Tip): boolean
}
const Context = createContext<Context | null>(null)
export function OnboardingProvider({ children, store = onboardingStore }: { children: ReactNode; store?: KeyValueAdapter }) {
  const [record, setRecord] = useState(initialOnboarding)
  const current = useRef(record), revision = useRef(0), writes = useRef(Promise.resolve())
  const [ready, setReady] = useState(false), [automatic, setAutomatic] = useState(false)
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive')
  const [sessionUsed, setSessionUsed] = useState(false), claimed = useRef(false)
  const [pending, setPending] = useState<Pending>(null)
  useEffect(() => {
    let active = true
    const started = revision.current
    void Promise.resolve().then(() => store.get(ONBOARDING_KEY)).then(raw => {
      if (!active) return
      if (revision.current === started) { current.current = readOnboarding(raw); setRecord(current.current) }
      setReady(true); setAutomatic(true)
    }, () => { if (active) { setReady(true); setAutomatic(false) } })
    return () => { active = false }
  }, [store])
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      const active = state === 'active'
      setForeground(active)
      if (!active) setPending(null)
      else { claimed.current = false; setSessionUsed(false) }
    })
    return () => listener.remove()
  }, [])
  const update = useCallback((patch: Partial<OnboardingRecord> | ((current: OnboardingRecord) => Partial<OnboardingRecord>)) => {
    revision.current += 1
    const next = { ...current.current, ...(typeof patch === 'function' ? patch(current.current) : patch) }
    current.current = next; setRecord(next)
    writes.current = writes.current.then(() => store.set(ONBOARDING_KEY, JSON.stringify(next))).catch(() => {})
  }, [store])
  const request = useCallback((restart = false, sessionId?: number) => setPending({ sessionId: sessionId ?? null, restart }), [])
  const clearPending = useCallback(() => setPending(null), [])
  const claimTip = useCallback((tip: Tip) => {
    if (claimed.current) return false
    claimed.current = true; setSessionUsed(true)
    update({ presented: [...new Set([...current.current.presented, tip])] })
    return true
  }, [update])
  const value = useMemo(() => ({ record, ready, automatic, foreground, pending, sessionUsed, update, request, clearPending, claimTip }),
    [record, ready, automatic, foreground, pending, sessionUsed, update, request, clearPending, claimTip])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
// Screens rendered outside the application shell (component previews) do not solicit onboarding.
const absent: Context = { record: initialOnboarding, ready: false, automatic: false, foreground: true, pending: null, sessionUsed: true,
  update: () => {}, request: () => {}, clearPending: () => {}, claimTip: () => false }
export function useOnboarding() { return useContext(Context) ?? absent }
