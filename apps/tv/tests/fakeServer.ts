import { jest } from '@jest/globals'
import { createReaderApi, type CableCallbacks, type CableClient } from '@tarkman/reader'
import { readerText } from '../src/i18n'
import type { ReaderTransport } from '../src/reader'

export const API = 'https://api.example.test'
export const endpoints = { api: API, cable: 'wss://api.example.test/cable' }

interface Part { id: number; liturgyPartId: number; position: number; en: string | null; ru?: string | null; grabar?: string | null; translit?: string | null; role?: string; page?: number }
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

  // The public directory, display links and current-service discovery used by the saved church display (#215).
  interface FakeChurch { id: string; name: string; locality?: string | null }
  interface FakeLink { id: string; title: string; token: string; userId: number }
  const churches: FakeChurch[] = []
  const churchLinks = new Map<string, FakeLink[]>()
  const linkState = new Map<string, { userId: number; version: number; over: Record<string, unknown>; status: number }>()
  const currentByUser = new Map<number, number | null>()
  const linkSubscriptions = new Map<string, CableCallbacks>()
  let directoryFail = false, currentFail = false
  const linkConfig = (token: string) => {
    const l = linkState.get(token)!
    return { token, user_id: l.userId, title: null, mode: 'parallel', lang1: 'translit', lang2: 'en', show_explanations: false, show_notifications: true,
      status_view: 'full', config_version: l.version, updated_at: '2026-09-29T12:00:00Z', expires_at: null,
      device_type: 'tv', font_scale: 100, margin_percent: null, text_movement: 'continuous', language_sync: 'linked', ...l.over }
  }

  const partRow = (p: Part) => ({ part: { id: p.id, liturgy_part_id: p.liturgyPartId, liturgy_id: 1, position: p.position, role: p.role ?? 'priest',
    en: p.en, ru: p.ru ?? null, grabar: p.grabar ?? null, translit: p.translit ?? null, page: p.page ?? null } })
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
    if (path === '/public/churches' || /^\/public\/churches\/[^/]+\/display_links$/.test(path)) {
      if (directoryFail) return json({ error: 'boom' }, 500)
      if (path === '/public/churches') {
        const params = new URL(url).searchParams
        const query = (params.get('q') ?? '').toLowerCase(), perPage = Number(params.get('per_page') ?? 25), pageNo = Number(params.get('page') ?? 1)
        const matches = churches.filter(c => !query || c.name.toLowerCase().includes(query))
        const page = matches.slice((pageNo - 1) * perPage, pageNo * perPage)
        return json({ schema_version: 1, churches: page.map(c => ({ id: c.id, name: c.name, locality: c.locality ?? null, secret_note: 'must not surface' })),
          pagination: { page: pageNo, per_page: perPage, total_count: matches.length, next_page: pageNo * perPage < matches.length ? pageNo + 1 : null } })
      }
      const id = decodeURIComponent(path.split('/')[3])
      const church = churches.find(c => c.id === id)
      if (!church) return json({ error: 'church_not_found' }, 404)
      return json({ schema_version: 1, church: { id: church.id, name: church.name, locality: church.locality ?? null },
        display_links: (churchLinks.get(id) ?? []).map(l => ({ id: l.id, title: l.title, token: l.token, owner_email: 'must@not.surface' })) })
    }
    const linkMatch = /^\/display_links\/([^/]+)$/.exec(path)
    if (linkMatch) {
      const state = linkState.get(decodeURIComponent(linkMatch[1]))
      if (!state) return json({ error: 'not_found' }, 404)
      if (state.status !== 200) return json({ error: 'gone' }, state.status)
      return json(linkConfig(decodeURIComponent(linkMatch[1])))
    }
    const currentMatch = /^\/s\/(\d+)\/current\.json$/.exec(path)
    if (currentMatch) {
      if (currentFail) return json({ error: 'boom' }, 500)
      const current = currentByUser.get(Number(currentMatch[1])) ?? null
      return current !== null && sessions.has(current) ? json(sessionJson(current)) : json({ status: 'inactive' })
    }
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
    if (typeof id === 'object' && id.channel === 'DisplayLinkChannel') {
      // Keyed by token, not by session.
      const token = id.token
      linkSubscriptions.set(token, callbacks)
      return () => { if (linkSubscriptions.get(token) === callbacks) linkSubscriptions.delete(token) }
    }
    const session = typeof id === 'object' ? id.id : id
    subscriptions.set(session, callbacks)
    return () => { if (subscriptions.get(session) === callbacks) subscriptions.delete(session) }
  } }
  const transport: ReaderTransport = { api: base => createReaderApi({ base, text: readerText, request: request as unknown as typeof fetch }), cable: () => cable }

  return {
    transport, requests, request,
    addService(session: Session, sessionParts: Part[], currentLiturgyPartId: number | null = sessionParts[0]?.liturgyPartId ?? null) {
      sessions.set(session.id, session); parts.set(session.id, sessionParts)
      cursor.set(session.id, { revision: 1, liturgyPartId: currentLiturgyPartId, status: session.status })
      listed.add(session.id)
    },
    /** Publishes a church and its display links. Each link names the operator (`userId`) whose current service it follows. */
    addChurch(church: FakeChurch, links: FakeLink[] = []) {
      churches.push(church); churchLinks.set(church.id, links)
      for (const link of links) linkState.set(link.token, { userId: link.userId, version: 1, over: {}, status: 200 })
    },
    setCurrentService(userId: number, sessionId: number | null) { currentByUser.set(userId, sessionId) },
    failDirectory(fail: boolean) { directoryFail = fail },
    failCurrent(fail: boolean) { currentFail = fail },
    /** A revoked (404/403) or expired (410) display link; the token read then reports it unavailable. */
    setLinkStatus(token: string, status: 200 | 403 | 404 | 410) { linkState.get(token)!.status = status },
    /** The operator edits the display: the version rises and the channel publishes a complete snapshot. */
    updateLink(token: string, over: Record<string, unknown>) {
      const l = linkState.get(token)!
      l.version += 1; l.over = { ...l.over, ...over }
      linkSubscriptions.get(token)?.received({ event: 'display_link.updated', data: linkConfig(token) })
    },
    linkSubscribed(token: string) { return linkSubscriptions.has(token) },
    connectedLink(token: string) { linkSubscriptions.get(token)?.connected() },
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
