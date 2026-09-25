import { beforeEach, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { ReadingFontContext } from '../design/readingFont'
import { PreferencesProvider } from '../features/preferences/PreferencesProvider'
import { SessionReader } from '../features/live/SessionReader'
import { useReader } from '../features/live/useReader'
import { initialState, type ReaderState } from '../features/live/state'
import { normalizeExplanations, normalizeParts, normalizeSession } from '../features/live/contracts'
import { explanationContextKey, explanationOwnerKey } from '../features/live/explanationCue'
import { useExplanationCue } from '../features/live/useExplanationCue'

jest.mock('../features/live/useReader')
jest.mock('../features/auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'signedOut' } }) }))
const mockFocusListeners = new Set<() => void | (() => void)>()
const mockBlurListeners = new Set<() => void>()
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: (effect: () => void | (() => void)) => {
  jest.requireActual<typeof import('react')>('react').useEffect(() => {
    mockFocusListeners.add(effect)
    const cleanup = effect(); if (cleanup) mockBlurListeners.add(cleanup)
    return () => { mockFocusListeners.delete(effect); if (cleanup) { mockBlurListeners.delete(cleanup); cleanup() } }
  }, [effect])
} }))
let mockLifecycle: (active: boolean, online: boolean) => void
jest.mock('../features/live/lifecycle', () => ({ lifecycle: { listen: (callback: typeof mockLifecycle) => { mockLifecycle = callback; return () => {} } } }))
const store = { get: async () => null, set: async () => {}, remove: async () => {} }
const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider><ReadingFontContext.Provider value={true}><PreferencesProvider store={store}>{children}</PreferencesProvider></ReadingFontContext.Provider></ThemeProvider>
const endpoints = { api: 'https://example.test', cable: 'wss://example.test/cable' }
const parts = normalizeParts({ parts: [1, 2].map(position => ({ part: { id: 1, liturgy_id: 10, liturgy_part_id: 10 + position, position, en: `Prayer ${position}` } })) })
const explanations = (title = 'Authored') => normalizeExplanations({ explanations: [{ explanation: { id: 1, title, description: 'Body', liturgy_part_id: 11 } }] })
function ready(): ReaderState {
  const session = normalizeSession({ session: { id: 7, status: 'active', current_part_id: 1, current_liturgy_id: 10, current_part_position: 1, parts_context: 'parts' } })
  return { ...initialState, session, parts, explanations: explanations(), loading: false, stale: false, connected: true,
    explanationProvenance: { ownerKey: explanationOwnerKey(7, parts[0].key), contextKey: explanationContextKey(session), requestId: 1, status: 'ready' } }
}
let state: ReaderState
const retry = jest.fn(), dispatch = jest.fn()
function supply() { jest.mocked(useReader).mockReturnValue({ state, saved: null, retry, dispatch, refreshAfterCommand: jest.fn() }) }
beforeEach(() => { state = ready(); retry.mockClear(); dispatch.mockClear(); supply() })
const tree = (id = 7) => <SessionReader endpoints={endpoints} id={id} back={() => {}} />
const badge = () => screen.queryByTestId('reader-explain-badge', { includeHiddenElements: true })
const open = async () => fireEvent.press(screen.getByTestId('reader-explain'))
const show = async () => fireEvent(screen.getByTestId('app-modal'), 'show')
const layout = async () => fireEvent(screen.getByTestId('explanation-collection'), 'layout', { nativeEvent: { layout: { width: 300, height: 200 } } })
const close = async () => { const dismissed = screen.getByTestId('app-modal').props.onDismiss; await fireEvent.press(screen.getByRole('button', { name: 'Close Explanation' })); await act(() => dismissed()) }
it('requires both show and committed content; keeps availability and access after presentation without requests', async () => {
  await render(tree(), { wrapper })
  expect(badge()).not.toBeNull()
  expect(screen.getByTestId('reader-explain').props.accessibilityLabel).toBe('Explain current part, 1 new explanation')
  expect(screen.getByTestId('reader-explain').props.accessibilityState.selected).not.toBe(true)
  await open(); expect(badge()).not.toBeNull()
  await layout(); expect(badge()).not.toBeNull()
  await show(); expect(badge()).toBeNull()
  await close(); await open(); await show(); await layout()
  expect(screen.getByText('Authored')).toBeTruthy(); expect(badge()).toBeNull()
  expect(screen.getByTestId('reader-explain', { includeHiddenElements: true }).props.accessibilityHint).toContain('available')
  expect(retry).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled()
})
it('acknowledges same-size new batches in an open sheet without another show/layout', async () => {
  const view = await render(tree(), { wrapper }); await open(); await show(); await layout()
  state = { ...state, explanations: explanations('Replaced'), explanationProvenance: { ...state.explanationProvenance, requestId: 2 } }; supply()
  await view.rerender(tree())
  expect(screen.getByText('Replaced')).toBeTruthy(); expect(badge()).toBeNull()
  await close(); expect(badge()).toBeNull()
})
it.each(['background', 'focus', 'offline'] as const)('retains shown marker through %s and acknowledges fresh return without show/layout', async reason => {
  const view = await render(tree(), { wrapper }); await open(); await show(); await layout()
  await act(() => { if (reason === 'focus') mockBlurListeners.forEach(fn => fn()); else mockLifecycle(reason !== 'background', reason !== 'offline') })
  state = { ...state, stale: true, explanations: [], explanationProvenance: { ...state.explanationProvenance, status: 'invalid' } }; supply(); await view.rerender(tree())
  state = { ...state, stale: false, explanations: explanations('New while hidden'), explanationProvenance: { ...state.explanationProvenance, requestId: 2, status: 'ready' } }; supply(); await view.rerender(tree())
  expect(badge()).toBeNull()
  await act(() => { if (reason === 'focus') mockFocusListeners.forEach(fn => fn()); else mockLifecycle(true, true) })
  expect(badge()).toBeNull(); await close(); expect(badge()).toBeNull()
})
it('loading-only dismissal and obsolete show callbacks do not acknowledge a later batch/opening', async () => {
  state = { ...state, explanations: [], explanationsLoading: true, explanationProvenance: { ...state.explanationProvenance, status: 'loading' } }; supply()
  const view = await render(tree(), { wrapper }); await open()
  const lateShow = screen.getByTestId('app-modal').props.onShow
  await close(); state = ready(); supply(); await view.rerender(tree())
  expect(badge()).not.toBeNull()
  await open(); await layout(); await act(() => lateShow())
  expect(badge()).not.toBeNull()
  await show(); expect(badge()).toBeNull()
})
it('a changed occurrence owns its independent badge and returning/manual browsing preserves history', async () => {
  const view = await render(tree(), { wrapper }); await open(); await show(); await layout(); await close()
  state = { ...state, following: false, session: { ...state.session!, currentPosition: 2 }, explanationProvenance: { ...state.explanationProvenance, ownerKey: explanationOwnerKey(7, parts[1].key), requestId: 2 } }; supply(); await view.rerender(tree())
  expect(badge()).not.toBeNull()
  state = { ...ready(), following: false }; supply(); await view.rerender(tree())
  expect(badge()).toBeNull()
  await fireEvent.press(screen.getByTestId('reader-preferences'))
  expect(badge()).toBeNull()
})
it('errors and another sheet cannot consume current content', async () => {
  const view = await render(tree(), { wrapper }); await fireEvent.press(screen.getByTestId('reader-preferences')); await show()
  expect(badge()).not.toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Close Reading preferences' }))
  state = { ...state, explanationError: true, explanationProvenance: { ...state.explanationProvenance, status: 'error' } }; supply(); await view.rerender(tree()); await open(); await show()
  expect(screen.queryByText('Authored')).toBeNull()
  await close(); state = ready(); supply(); await view.rerender(tree()); expect(badge()).not.toBeNull()
})
it('fences queued hidden callbacks, scope A → B → A, and disposal at the hook boundary', async () => {
  const shown = {}, other = {}
  const hook = await renderHook<ReturnType<typeof useExplanationCue>, { scope: string; presentation: object | null }>(({ scope, presentation }) => useExplanationCue(scope, state, true, presentation), { initialProps: { scope: 'A', presentation: shown as object | null } })
  const a = hook.result.current.batch!, acknowledge = hook.result.current.acknowledgePresented
  await hook.rerender({ scope: 'A', presentation: null })
  await act(() => acknowledge(a, shown)); expect(hook.result.current.newCount).toBe(1)
  await hook.rerender({ scope: 'A', presentation: other })
  await act(() => acknowledge(a, shown)); expect(hook.result.current.newCount).toBe(1)
  await hook.rerender({ scope: 'B', presentation: shown }); await hook.rerender({ scope: 'A', presentation: shown })
  await act(() => acknowledge(a, shown)); expect(hook.result.current.newCount).toBe(1)
  await act(() => acknowledge(hook.result.current.batch!, shown)); expect(hook.result.current.newCount).toBe(0)
  await hook.unmount(); await act(() => acknowledge(a, shown))
})
it('resets a real mounted reader across A → B → A and rejects the first opening show callback', async () => {
  const view = await render(tree(), { wrapper }); await open(); await show(); await layout(); await close()
  expect(badge()).toBeNull()
  await open(); await layout(); const obsoleteShow = screen.getByTestId('app-modal').props.onShow
  state = { ...ready(), session: { ...state.session!, id: 8 }, explanationProvenance: { ...state.explanationProvenance, ownerKey: explanationOwnerKey(8, parts[0].key) } }; supply()
  await view.rerender(tree(8))
  state = ready(); supply(); await view.rerender(tree(7))
  expect(badge()).not.toBeNull()
  await act(() => obsoleteShow()); expect(badge()).not.toBeNull()
  await show(); expect(badge()).toBeNull()
})
it('a queued acknowledgment is rejected immediately when presentation is revoked', async () => {
  const shown = {}
  const hook = await renderHook(() => useExplanationCue('scope', state, true, shown))
  const batch = hook.result.current.batch!
  await act(() => {
    hook.result.current.invalidatePresentation()
    hook.result.current.acknowledgePresented(batch, shown)
  })
  expect(hook.result.current.newCount).toBe(1)
})
