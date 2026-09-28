import { jest } from '@jest/globals'
import { createReaderApi, type CableCallbacks, type CableClient } from '@tarkman/reader'
import { readerText } from '../src/i18n'
import type { ReaderTransport } from '../src/reader'

export const API = 'https://api.example.test'
export const endpoints = { api: API, cable: 'wss://api.example.test/cable' }

interface Part { id: number; liturgyPartId: number; position: number; en: string | null; ru?: string | null; grabar?: string | null; role?: string }
interface Session { id: number; church: string; title: string; status: string; message?: string | null }

/**
 * A synthetic Rails public API. Responses use the real wire shapes, and every request is recorded so
 * tests can prove the TV only ever reads.
 */
export function fakeServer() {
  const sessions = new Map<number, Session>()
  const parts = new Map<number, Part[]>()
  const cursor = new Map<number, { revision: number; liturgyPartId: number | null; status: string }>()
  let listed = new Set<number>()
  let servicesFail = false
  const requests: { url: string; method: string }[] = []
  const subscriptions = new Map<number, CableCallbacks>()

  const partRow = (p: Part) => ({ part: { id: p.id, liturgy_part_id: p.liturgyPartId, liturgy_id: 1, position: p.position, role: p.role ?? 'priest',
    en: p.en, ru: p.ru ?? null, grabar: p.grabar ?? null, translit: null } })
  const context = (id: number) => `manifest-${id}-${(parts.get(id) ?? []).length}`
  const state = (id: number) => {
    const c = cursor.get(id)!, s = sessions.get(id)!
    const part = (parts.get(id) ?? []).find(p => p.liturgyPartId === c.liturgyPartId)
    return { id, revision: c.revision, content_context: context(id), session_status: c.status, status_message: s.message ?? null, posture: null, date: '2026-09-28',
      cursor: part ? { part_id: part.id, liturgy_part_id: part.liturgyPartId, liturgy_id: 1, position: part.position } : null }
  }
  const sessionJson = (id: number) => {
    const s = sessions.get(id)!, c = cursor.get(id)!
    const part = (parts.get(id) ?? []).find(p => p.liturgyPartId === c.liturgyPartId)
    return { session: { id, liturgy: s.title, church_name: s.church, status: c.status, status_message: s.message ?? null, date: '2026-09-28', revision: c.revision,
      current_part_id: part?.id ?? null, current_liturgy_part_id: part?.liturgyPartId ?? null, current_liturgy_id: 1, current_part_position: part?.position ?? null,
      liturgies: [{ id: 1, name: s.title, position: 1 }], num_of_parts: Math.max(1, (parts.get(id) ?? []).length) } }
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  const request = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    requests.push({ url, method: (init?.method ?? 'GET').toUpperCase() })
    const path = url.slice(API.length).split('?')[0]
    if (path === '/services.json') {
      if (servicesFail) return json({ error: 'boom' }, 500)
      const rows = [...listed].map(sessionJson)
      return json(rows.length ? rows : { message: 'There are no current services taking place.' })
    }
    const match = /^\/s\/(\d+)(\.json|\/parts\.json|\/state\.json)$/.exec(path)
    const id = match ? Number(match[1]) : NaN
    if (!match || !sessions.has(id)) return json({ code: 'session_not_found' }, 404)
    if (match[2] === '.json') return json(sessionJson(id))
    if (match[2] === '/parts.json') return json({ parts: (parts.get(id) ?? []).map(partRow) })
    return json({ session: state(id) })
  })

  const cable: CableClient = { subscribe: (_url, id, callbacks) => {
    subscriptions.set(Number(id), callbacks)
    return () => { if (subscriptions.get(Number(id)) === callbacks) subscriptions.delete(Number(id)) }
  } }
  const transport: ReaderTransport = { api: base => createReaderApi({ base, text: readerText, request: request as unknown as typeof fetch }), cable: () => cable }

  return {
    transport, requests, request,
    addService(session: Session, sessionParts: Part[], currentLiturgyPartId: number | null = sessionParts[0]?.liturgyPartId ?? null) {
      sessions.set(session.id, session); parts.set(session.id, sessionParts)
      cursor.set(session.id, { revision: 1, liturgyPartId: currentLiturgyPartId, status: session.status })
      listed.add(session.id)
    },
    unlist(id: number) { listed = new Set([...listed].filter(value => value !== id)) },
    failServices(fail: boolean) { servicesFail = fail },
    connected(id: number) { subscriptions.get(id)?.connected() },
    disconnected(id: number) { subscriptions.get(id)?.disconnected() },
    subscribed(id: number) { return subscriptions.has(id) },
    /** The operator advances: the server moves the cursor and publishes the new state on the cable. */
    advance(id: number, liturgyPartId: number) {
      const c = cursor.get(id)!
      cursor.set(id, { ...c, revision: c.revision + 1, liturgyPartId })
      subscriptions.get(id)?.received({ event: 'part_change', data: { session: id, ...state(id) } })
    },
    setStatus(id: number, status: string) {
      const c = cursor.get(id)!
      cursor.set(id, { ...c, revision: c.revision + 1, status })
      subscriptions.get(id)?.received({ event: 'status_change', data: { session_id: id, ...state(id) } })
    },
  }
}
