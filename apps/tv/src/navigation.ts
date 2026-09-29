/** The TV's screens. There is no router on tvOS; this stack is the whole navigation model. */
export type Route =
  | { name: 'services' }
  | { name: 'reader'; id: number }
  | { name: 'settings' }
  /** Launch root when a church display is saved. */
  | { name: 'savedDisplay' }
  /** Above the saved display: change, browse, settings and reset. Back returns to the display. */
  | { name: 'savedManage' }
  /** Launch root when the saved record cannot be read; explains and offers recovery. */
  | { name: 'savedProblem' }
  | { name: 'churches' }
  | { name: 'churchLinks'; churchId: string }

export interface NavigationState {
  stack: Route[]
  /** Where focus returns on the service list after Back: the service last opened. */
  lastServiceId: number | null
  /** Where focus returns on the church list after Back: the church last opened. */
  lastChurchId: string | null
}
export type NavigationAction = { type: 'push'; route: Route } | { type: 'back' } | { type: 'root'; route: Route }

export function navigationFor(root: Route): NavigationState { return { stack: [root], lastServiceId: null, lastChurchId: null } }
export const initialNavigation: NavigationState = navigationFor({ name: 'services' })

export function navigate(state: NavigationState, action: NavigationAction): NavigationState {
  if (action.type === 'back') return state.stack.length > 1 ? { ...state, stack: state.stack.slice(0, -1) } : state
  // A new root replaces the whole stack (a saved or reset display), so Back never returns into a stale flow.
  if (action.type === 'root') return { ...state, stack: [action.route] }
  return {
    stack: [...state.stack, action.route],
    lastServiceId: action.route.name === 'reader' ? action.route.id : state.lastServiceId,
    lastChurchId: action.route.name === 'churchLinks' ? action.route.churchId : state.lastChurchId,
  }
}
export function currentRoute(state: NavigationState): Route { return state.stack[state.stack.length - 1] }
/** At the root, Menu must leave the app for the Apple TV home screen, as tvOS users expect. */
export function canGoBack(state: NavigationState): boolean { return state.stack.length > 1 }
