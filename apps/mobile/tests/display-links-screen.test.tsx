import { afterEach, beforeEach, expect, it } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { I18nProvider, setActiveInterfaceLanguage } from '../features/i18n'
import { DisplayLinkScreen } from '../features/displayLinks/DisplayLinkScreen'
import type { DisplayLinkConfig } from '../features/displayLinks/config'

const config: DisplayLinkConfig = {
  token: 'abc', user_id: 7, mode: 'parallel', lang1: 'translit', lang2: null,
  show_explanations: false, show_notifications: true, status_view: 'full',
  church_name: 'St. John', title: 'Divine Liturgy',
}

beforeEach(() => { setActiveInterfaceLanguage('en') })
afterEach(() => { setActiveInterfaceLanguage('en') })

function fakeFetch(handlers: Record<string, () => Promise<Response>>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    for (const [match, handler] of Object.entries(handlers)) if (url.endsWith(match)) return handler()
    throw new Error(`Unhandled: ${url}`)
  }) as unknown as typeof fetch
}

function renderScreen(token: string, request: typeof fetch = globalThis.fetch) {
  return render(
    <ThemeProvider><I18nProvider><DisplayLinkScreen apiBase="https://api.test" token={token} request={request} /></I18nProvider></ThemeProvider>,
  )
}

it('renders the church name and title once the token configuration loads', async () => {
  const request = fakeFetch({ '/display_links/abc': async () => new Response(JSON.stringify(config), { status: 200, headers: { 'Content-Type': 'application/json' } }) })
  renderScreen('abc', request)
  await waitFor(() => expect(screen.getByTestId('display-loaded')).toBeOnTheScreen())
  expect(screen.getByText('St. John')).toBeOnTheScreen()
  expect(screen.getByText('Divine Liturgy')).toBeOnTheScreen()
})

it('renders a clear message, not a blank screen, when the token is invalid', async () => {
  const request = fakeFetch({ '/display_links/bad': async () => new Response('', { status: 404 }) })
  renderScreen('bad', request)
  await waitFor(() => expect(screen.getByTestId('display-invalid')).toBeOnTheScreen())
  expect(screen.getByText('Invalid or expired display link.')).toBeOnTheScreen()
})

it('treats a missing token as invalid rather than rendering a placeholder', async () => {
  renderScreen('')
  await waitFor(() => expect(screen.getByTestId('display-invalid')).toBeOnTheScreen())
  expect(screen.getByText('Invalid or expired display link.')).toBeOnTheScreen()
})
