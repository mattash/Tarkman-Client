import type { ReactNode } from 'react'
import type { MyService } from '../features/services/api'
import { expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo, Platform } from 'react-native'
import MyServicesScreen from '../app/(signed-in)/services'
import { ThemeProvider } from '../design/ThemeProvider'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { AUTH_KEY } from '../features/auth/session'
import { API, fakeApi, memoryStore, respond, storedAuth } from './auth-helpers'

// Keep pagination events explicit; native list measurements are unrelated to announcements.
jest.mock('@shopify/flash-list', () => ({
  FlashList: ({ ListHeaderComponent, ListFooterComponent, data, renderItem, ...props }: { ListHeaderComponent: ReactNode; ListFooterComponent: ReactNode; data: MyService[]; renderItem: (info: { item: MyService }) => ReactNode }) => {
    const { View } = jest.requireActual<typeof import('react-native')>('react-native')
    return <View {...props}>{ListHeaderComponent}{data.map((item: MyService) => <View key={item.id}>{renderItem({ item })}</View>)}{ListFooterComponent}</View>
  },
}))
function ReadyServices() {
  return useAuth().state.status === 'signedIn' ? <MyServicesScreen /> : null
}
const services = { sessions: [{ session: { id: 9, liturgy: 'Divine Liturgy' } }] }
async function renderApp(store: ReturnType<typeof memoryStore>['store'], request: typeof fetch) {
  await render(<ThemeProvider scheme="light"><AuthProvider apiBase={API} store={store} request={request}><ReadyServices /></AuthProvider></ThemeProvider>)
}


it.each(['ios', 'android', 'web'] as const)('announces pagination completion once on %s', async platform => {
  const previous = Platform.OS
  Platform.OS = platform
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {}).mockClear()
  const page = (next: string | null) => ({ ...services, page: { limit: 20, has_more: next !== null, next_cursor: next } })
  let firstAttempts = 0
  const request = fakeApi({
    'GET /s.json?pagination=cursor&limit=20': () => ++firstAttempts === 2 ? respond(500) : respond(200, page('next')),
    'GET /s.json?pagination=cursor&limit=20&cursor=next': () => respond(200, page(null)),
  })
  try {
    await renderApp(memoryStore({ [AUTH_KEY]: storedAuth() }).store, request)
    await screen.findByText('Divine Liturgy')
    expect(announce).not.toHaveBeenCalled()
    await fireEvent(screen.getByTestId('my-services-list'), 'endReached')
    expect(await screen.findByText('All sessions loaded')).toBeOnTheScreen()
    expect(screen.getByText('All sessions loaded').props.accessibilityLiveRegion).toBe('polite')
    expect(announce).toHaveBeenCalledTimes(platform === 'web' ? 0 : 1)
    if (platform !== 'web') expect(announce).toHaveBeenCalledWith('All sessions loaded')
    await fireEvent(screen.getByTestId('my-services-list'), 'endReached')
    await fireEvent(screen.getByTestId('my-services-list'), 'refresh')
    await screen.findByRole('alert')
    expect(announce).toHaveBeenCalledTimes(platform === 'web' ? 0 : 1)
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('button', { name: 'Load more sessions' })
    expect(announce).toHaveBeenCalledTimes(platform === 'web' ? 0 : 1)
    await fireEvent(screen.getByTestId('my-services-list'), 'endReached')
    await screen.findByText('All sessions loaded')
    expect(announce).toHaveBeenCalledTimes(platform === 'web' ? 0 : 2)
  } finally {
    announce.mockRestore()
    Platform.OS = previous
  }
})

it.each([services, { error: 'No sessions found' }, { sessions: [], page: { limit: 20, has_more: false, next_cursor: null } }])('does not announce initial complete response %j', async body => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {}).mockClear()
  try {
    await renderApp(memoryStore({ [AUTH_KEY]: storedAuth() }).store,
      fakeApi({ 'GET /s.json?pagination=cursor&limit=20': () => respond(200, body) }))
    await screen.findByText(body.sessions?.length ? 'Divine Liturgy' : 'No sessions yet')
    expect(announce).not.toHaveBeenCalled()
  } finally { announce.mockRestore() }
})
