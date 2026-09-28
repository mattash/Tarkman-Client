/** The TV's screens. There is no router on tvOS; this stack is the whole navigation model. */
export type Route =
  | { name: 'services' }
  | { name: 'reader'; id: number }
  | { name: 'settings' }
  | { name: 'displaySetup' }

export interface NavigationState {
  stack: Route[]
  /** Where focus returns on the service list after Back: the service last opened. */
  lastServiceId: number | null
}
export type NavigationAction = { type: 'push'; route: Route } | { type: 'back' }

export const initialNavigation: NavigationState = { stack: [{ name: 'services' }], lastServiceId: null }

export function navigate(state: NavigationState, action: NavigationAction): NavigationState {
  if (action.type === 'back') return state.stack.length > 1 ? { ...state, stack: state.stack.slice(0, -1) } : state
  return { stack: [...state.stack, action.route], lastServiceId: action.route.name === 'reader' ? action.route.id : state.lastServiceId }
}
export function currentRoute(state: NavigationState): Route { return state.stack[state.stack.length - 1] }
/** At the root, Menu must leave the app for the Apple TV home screen, as tvOS users expect. */
export function canGoBack(state: NavigationState): boolean { return state.stack.length > 1 }
