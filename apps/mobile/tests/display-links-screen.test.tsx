import { afterEach, beforeEach, expect, it, jest } from '@jest/globals'
import { act, render, screen } from '@testing-library/react-native'
import { DisplayLinkScreen } from '../features/displayLinks/DisplayLinkScreen'
import type { DisplayLinkConfig } from '../features/displayLinks/config'

jest.mock('../features/keepAwake/useScreenKeepAwake', () => ({ useScreenKeepAwake: jest.fn() }))
jest.mock('../features/live/cable', () => ({ createCable: () => ({ subscribe: () => () => {} }) }))
jest.mock('../features/live/lifecycle', () => ({ lifecycle: { listen: (callback: (active: boolean, online: boolean) => void) => { callback(true, true); return () => {} } } }))
jest.mock('../features/displayLinks/DisplayProjection', () => ({ DisplayProjection: (props: unknown) => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native')
  return <Text testID="projection">{JSON.stringify(props)}</Text>
} }))

const endpoints = { api: 'https://api.test', cable: 'wss://api.test/cable' }
const config: DisplayLinkConfig = { token: 'abc', user_id: 7, mode: 'parallel', lang1: 'translit', lang2: 'en', show_explanations: false, show_notifications: true, status_view: 'full' }
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const current = (id: number) => ({ session: { id, liturgy: `Service ${id}` } })
const readProjection = () => JSON.parse(screen.getByTestId('projection').props.children as string)
const tick = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms) }) }
beforeEach(() => { jest.useFakeTimers() })
afterEach(() => { jest.useRealTimers() })

it('opens a public named service without a token and normalizes URL preferences', async () => {
  await render(<DisplayLinkScreen endpoints={endpoints} named params={{ id: '42', mode: 'single', lang1: 'grabar', show_notifications: 'false', show_explanations: '1' }} />)
  expect(readProjection()).toMatchObject({ sessionId: 42, config: { mode: 'single', lang1: 'grabar', show_notifications: false, show_explanations: true } })
})
it('uses stored preferences over conflicting URL parameters and follows the token owner', async () => {
  const request = jest.fn<typeof fetch>().mockImplementation(async input => String(input).includes('display_links') ? response(config) : response(current(42)))
  await render(<DisplayLinkScreen endpoints={endpoints} params={{ token: 'abc', user_id: '999', lang1: 'grabar', show_notifications: '0' }} request={request} />)
  expect(readProjection()).toMatchObject({ sessionId: 42, config })
  expect(request.mock.calls.some(([url]) => String(url).includes('/s/7/current.json?tz='))).toBe(true)
})
it.each(['', '0', '1.2', 'bad', '999999999999999999999'])('rejects an invalid named-service id %s', async id => {
  await render(<DisplayLinkScreen endpoints={endpoints} named params={{ id }} />)
  expect(screen.getByTestId('display-invalid')).toBeOnTheScreen()
})
it('rejects duplicate token parameters', async () => {
  await render(<DisplayLinkScreen endpoints={endpoints} params={{ token: ['abc', 'xyz'] }} />)
  expect(screen.getByTestId('display-invalid')).toBeOnTheScreen()
})
it.each([404, 410, 403])('shows invalid or expired links for HTTP %s', async status => {
  const request = jest.fn<typeof fetch>().mockResolvedValue(response({}, status))
  await render(<DisplayLinkScreen endpoints={endpoints} params={{ token: 'bad' }} request={request} />)
  expect(screen.getByText('Invalid or expired display link.')).toBeOnTheScreen()
})
it('retries a temporary token failure without calling it an invalid link', async () => {
  const request = jest.fn<typeof fetch>().mockResolvedValueOnce(response({}, 500)).mockResolvedValue(response(config))
  await render(<DisplayLinkScreen endpoints={endpoints} named params={{ id: '42', token: 'abc' }} request={request} />)
  expect(screen.getByText('Could not load the display configuration.')).toBeOnTheScreen()
  expect(screen.queryByTestId('display-invalid')).toBeNull()
  await tick(10000)
  expect(readProjection().sessionId).toBe(42)
})
it('removes projection when a token expires during an unattended session', async () => {
  const request = jest.fn<typeof fetch>().mockResolvedValueOnce(response(config)).mockResolvedValue(response({}, 410))
  await render(<DisplayLinkScreen endpoints={endpoints} named params={{ id: '42', token: 'abc' }} request={request} />)
  expect(readProjection().sessionId).toBe(42)
  await tick(10000)
  expect(screen.queryByTestId('projection')).toBeNull()
  expect(screen.getByTestId('display-invalid')).toBeOnTheScreen()
})
it('waits for a live service, switches services, and clears the old one when it ends', async () => {
  const request = jest.fn<typeof fetch>().mockResolvedValueOnce(response({ status: 'inactive' }))
    .mockResolvedValueOnce(response(current(42))).mockResolvedValueOnce(response(current(43)))
    .mockResolvedValue(response({ status: 'inactive' }))
  await render(<DisplayLinkScreen endpoints={endpoints} params={{ user_id: '7' }} request={request} />)
  expect(screen.getByText('Waiting for the service')).toBeOnTheScreen()
  await tick(5000); expect(readProjection().sessionId).toBe(42)
  await tick(5000); expect(readProjection().sessionId).toBe(43)
  await tick(5000); expect(screen.queryByTestId('projection')).toBeNull()
})
it('keeps the current reading but marks discovery failures, then recovers automatically', async () => {
  const request = jest.fn<typeof fetch>().mockResolvedValueOnce(response(current(42)))
    .mockRejectedValueOnce(new Error('network')).mockResolvedValue(response(current(43)))
  await render(<DisplayLinkScreen endpoints={endpoints} statusOnly params={{ user_id: '7' }} request={request} />)
  await tick(5000)
  expect(readProjection()).toMatchObject({ sessionId: 42, discoveryError: true, statusOnly: true })
  await tick(5000); expect(readProjection()).toMatchObject({ sessionId: 43, discoveryError: false })
})
it('discards an old token response after the URL changes', async () => {
  let resolveOld: (response: Response) => void = () => {}
  const request = jest.fn<typeof fetch>().mockImplementation(input => String(input).endsWith('/old')
    ? new Promise(resolve => { resolveOld = resolve }) : Promise.resolve(response({ ...config, token: 'new', lang1: 'grabar' })))
  const view = await render(<DisplayLinkScreen endpoints={endpoints} named params={{ id: '42', token: 'old' }} request={request} />)
  await view.rerender(<DisplayLinkScreen endpoints={endpoints} named params={{ id: '42', token: 'new' }} request={request} />)
  expect(readProjection().config.lang1).toBe('grabar')
  await act(async () => { resolveOld(response(config)) })
  expect(readProjection().config.lang1).toBe('grabar')
})
it('bounds a stalled configuration fetch and retries automatically', async () => {
  const request = jest.fn<typeof fetch>().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(response(config))
  await render(<DisplayLinkScreen endpoints={endpoints} named params={{ id: '42', token: 'abc' }} request={request} />)
  await tick(12000)
  expect(screen.getByText('Could not load the display configuration.')).toBeOnTheScreen()
  expect(request.mock.calls[0][1]?.signal?.aborted).toBe(true)
  await tick(10000)
  expect(readProjection().sessionId).toBe(42)
})
