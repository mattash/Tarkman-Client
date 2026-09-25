import { afterEach, expect, it, jest } from '@jest/globals'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { request as httpRequest } from 'node:http'
import { createReaderController } from '../features/live/controller'
import type { ReaderApi } from '../features/live/api'
import type { CableClient } from '../features/live/cable'
import { normalizeParts, normalizeSession, normalizeState } from '../features/live/contracts'

interface FixtureSocket {
  on(event: 'message', callback: (message: Buffer) => void): void
  on(event: 'open', callback: () => void): void
  send(message: string): void
  close(): void
}
const Socket = jest.requireActual<{ new(url: string): FixtureSocket }>('ws')
let fixture: ChildProcess | null = null
const stops: (() => void)[] = []
afterEach(() => { stops.splice(0).forEach(stop => stop()); fixture?.kill(); fixture = null })

async function startFixture(): Promise<string> {
  fixture = spawn(process.execPath, [resolve(__dirname, '../qa/display/server.cjs')], {
    env: { ...process.env, DISPLAY_FIXTURE_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  return new Promise((resolveUrl, reject) => {
    const timeout = setTimeout(() => reject(new Error('Display fixture did not start')), 5000)
    fixture!.stdout!.on('data', chunk => {
      const port = /Synthetic display review: http:\/\/127\.0\.0\.1:(\d+)/.exec(String(chunk))?.[1]
      if (port) { clearTimeout(timeout); resolveUrl(`http://127.0.0.1:${port}`) }
    })
    fixture!.once('error', error => { clearTimeout(timeout); reject(error) })
    fixture!.once('exit', code => { clearTimeout(timeout); reject(new Error(`Display fixture exited: ${code}`)) })
  })
}
async function until(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error('Timed out waiting for fixture publication adoption')
}

function fixtureJson(url: string, payload?: unknown): Promise<{ code: number; data: unknown }> {
  return new Promise((resolveResponse, reject) => {
    const request = httpRequest(url, { method: payload === undefined ? 'GET' : 'PATCH', headers: { 'Content-Type': 'application/json' } }, response => {
      let body = ''
      response.on('data', chunk => { body += String(chunk) })
      response.on('end', () => resolveResponse({ code: response.statusCode ?? 0, data: JSON.parse(body) }))
    })
    request.once('error', reject)
    request.end(payload === undefined ? undefined : JSON.stringify(payload))
  })
}
it('two connected readers adopt QR and active status_change without a state GET or part navigation', async () => {
  const base = await startFixture()
  const [rawState, rawSession, rawParts] = await Promise.all([
    fixtureJson(`${base}/s/9001/state.json`).then(response => response.data),
    fixtureJson(`${base}/s/9001.json`).then(response => response.data),
    fixtureJson(`${base}/s/9001/parts.json`).then(response => response.data),
  ])
  const state = normalizeState(rawState), session = normalizeSession(rawSession), parts = normalizeParts(rawParts)
  const stateRead = jest.fn<NonNullable<ReaderApi['state']>>().mockResolvedValue(state)
  const api: ReaderApi = {
    state: stateRead, services: jest.fn<ReaderApi['services']>().mockResolvedValue([session]),
    session: jest.fn<ReaderApi['session']>().mockResolvedValue(session),
    parts: jest.fn<ReaderApi['parts']>().mockResolvedValue(parts),
    explanations: jest.fn<ReaderApi['explanations']>().mockResolvedValue([]),
  }
  let connected = 0
  const cable: CableClient = { subscribe(_url, id, callbacks) {
    const socket = new Socket(base.replace('http:', 'ws:') + '/cable')
    const identifier = JSON.stringify({ channel: 'SessionChannel', id })
    socket.on('message', raw => {
      const frame = JSON.parse(String(raw))
      if (frame.type === 'welcome') socket.send(JSON.stringify({ command: 'subscribe', identifier }))
      if (frame.type === 'confirm_subscription') { connected++; callbacks.connected() }
      if (frame.message) callbacks.received(frame.message)
    })
    return () => socket.close()
  } }
  const readers = [0, 1].map(() => createReaderController(api, cable, 'ws://fixture/cable', { listen: () => () => {} }, 9001, undefined, false))
  readers.forEach(reader => stops.push(reader.start()))
  await until(() => connected === 2 && readers.every(reader => reader.getSnapshot().session?.revision === 1))
  stateRead.mockClear()
  const cursor = readers[0].getSnapshot().session?.currentLiturgyPartId
  async function command(status: string, expected_revision: number) {
    const response = await fixtureJson(`${base}/s/9001/update_status.json`, { status, expected_revision })
    expect(response.code).toBe(200)
    return response.data as { revision: number; emitted: { session_id: number; session: number } }
  }
  const shown = await command('showing_session_qr', 1)
  expect(shown).toMatchObject({ revision: 2, emitted: { session_id: 9001, session: 9001 } })
  await until(() => readers.every(reader => reader.getSnapshot().session?.status === 'showing_session_qr'))
  expect(readers.map(reader => reader.getSnapshot().session?.currentLiturgyPartId)).toEqual([cursor, cursor])
  const stopped = await command('active', 2)
  expect(stopped).toMatchObject({ revision: 3, emitted: { session_id: 9001 } })
  await until(() => readers.every(reader => reader.getSnapshot().session?.status === 'active' && reader.getSnapshot().session?.revision === 3))
  expect(readers.map(reader => reader.getSnapshot().session?.currentLiturgyPartId)).toEqual([cursor, cursor])
  expect(stateRead).not.toHaveBeenCalled()
  const log = await fixtureJson(`${base}/qa/log`).then(response => response.data) as { events: { kind: string; event?: string; path?: string }[] }
  expect(log.events.filter(entry => entry.kind === 'publication').map(entry => entry.event)).toEqual(['status_change', 'status_change'])
  expect(log.events.filter(entry => entry.kind === 'command').map(entry => entry.path)).toEqual(['/s/9001/update_status.json', '/s/9001/update_status.json'])
}, 15000)
