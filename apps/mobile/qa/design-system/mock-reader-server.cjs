#!/usr/bin/env node
/* global console, setInterval, clearInterval, Buffer, process */

// Local fixture for native and web reader/control QA. Its optional operator
// account is synthetic and only serves this loopback process.
// Run from the repository root with:
//   node apps/mobile/qa/design-system/mock-reader-server.cjs
// FIXTURE_SERVICES=single (default) | several | none chooses what /services.json lists,
// so the home screen's live, several-live and nothing-live states can each be checked.
// FIXTURE_MANAGEMENT=off hides the synthetic session-management routes (an older backend).

const http = require('node:http')
const { URL } = require('node:url')

const HOST = '127.0.0.1'
const PORT = 8100
const SESSION_ID = 9001
const SECOND_SESSION_ID = 9002
const SCENARIO = process.env.FIXTURE_SERVICES || 'single'
const LITURGY_ID = 99001
const OPERATOR = { email: 'operator@example.test', password: 'fixture-only-password', token: 'fixture-access-token', user: {
  id: 42, email: 'operator@example.test', name: 'Fixture operator', roles: ['priest'],
} }

const prayer = {
  grabar: 'Հայր մեր, որ յերկինս ես,\nսուրբ եղիցի անուն քո։\n\nԵկեսցէ արքայութիւն քո,\nեղիցին կամք քո որպէս յերկինս եւ յերկրի։',
  en: 'Our Father, who art in heaven,\nhallowed be thy name.\n\nThy kingdom come. Thy will be done,\non earth as it is in heaven.',
  ru: 'Отче наш, сущий на небесах!\nДа святится имя Твоё.\n\nДа приидет Царствие Твоё;\nда будет воля Твоя и на земле, как на небе.',
  translit: 'Hayr mer, vor hergins yes,\nsurp yeghitsi anun ko.\n\nYegestse arkayutyun ko,\nyeghitsin gamk ko vorbes hergins yev hergri.',
}

const longGrabar = Array.from({ length: 5 }, () => prayer.grabar).join('\n\n')
const explanation = {
  id: 79001,
  title: 'Sample explanation · Lord’s Prayer',
  description: 'Sample fixture explanation for native reading layout and sheet QA. This text is not live church content.',
  liturgy_part_id: 99001,
}

function makePart(id, position, overrides = {}) {
  return { part: {
    id,
    // Each occurrence gets its own liturgy_part_id, even when text repeats.
    liturgy_part_id: 99000 + position,
    liturgy_id: LITURGY_ID,
    role: position === 3 ? 'choir' : 'priest',
    position,
    grabar: position === 3 ? longGrabar : prayer.grabar,
    translit: prayer.translit,
    en: prayer.en,
    ru: position === 2 ? null : prayer.ru,
    explanation_ids: position === 1 ? [explanation.id] : [],
    posture: 'stand',
    page: position,
    ...overrides,
  } }
}

const parts = [makePart(901, 1), makePart(902, 2), makePart(903, 3)]
const session = { session: {
  id: SESSION_ID,
  liturgy: 'Sample Divine Liturgy · Lord’s Prayer',
  liturgy_id: LITURGY_ID,
  current_liturgy_id: LITURGY_ID,
  current_part_position: 1,
  current_part_id: parts[0].part.id,
  church_name: 'Sample parish · local design fixture',
  status: 'active',
  status_message: 'Sample data · local fixture only',
  date: new Date().toISOString().slice(0, 10),
  current_part_role: 'priest',
  // Apple Park, the simulator's default location, so the nearby match can be seen without setting one.
  church_latitude: 37.3349,
  church_longitude: -122.009,
} }
const secondSession = { session: {
  ...session.session,
  id: SECOND_SESSION_ID,
  liturgy: 'Second sample service · local fixture',
  church_name: 'Second sample parish · local design fixture',
  current_part_role: 'choir',
  church_latitude: 42.3736,
  church_longitude: -71.1097,
} }
const listed = { single: [session], several: [session, secondSession], none: [] }[SCENARIO] ?? [session]
// My Sessions: the operator's owned sessions, newest date first. Created fixture sessions join this list.
const owned = [session]
const management = require('./management-fixture.cjs').createManagement({
  enabled: process.env.FIXTURE_MANAGEMENT !== 'off', owned, church: 'Sample parish · local design fixture' })
const explanationEdits = new Map()
const presence = new Map()
function presenceSnapshot(id, client) {
  const now = Date.now()
  const entries = [...presence.entries()].filter(([key, value]) => key.startsWith(`${id}:`) && value.active && value.expires > now)
  const own = client ? presence.get(`${id}:${client}`) : null
  const self = !!own?.active && own.expires > now
  return { session_id: Number(id), reporting_scope: 'participating_clients', controller_count: entries.length,
    other_controller_count: client ? entries.length - Number(self) : null, self_present: client ? self : null,
    accepted_sequence: own?.sequence ?? null, server_time: new Date(now).toISOString(),
    self_expires_at: self ? new Date(own.expires).toISOString() : null,
    heartbeat_interval_seconds: 10, lease_ttl_seconds: 45 }
}
function explanationResponse() {
  const occurrence = parts.find(({ part }) => part.id === session.session.current_part_id).part
  return { explanations: (explanationEdits.get(occurrence.liturgy_part_id) ?? [explanation]).map(item => ({ explanation: { ...item, liturgy_part_id: occurrence.liturgy_part_id } })) }
}
function broadcast(event) {
  for (const socket of cableServer?.clients ?? []) {
    if (socket.readyState === 1 && socket.fixtureIdentifier) socket.send(JSON.stringify({ identifier: socket.fixtureIdentifier, message: { event, data: event === 'explanation_updated' ? { session_id: SESSION_ID } : { session: SESSION_ID } } }))
  }
}

function json(res, status, value, headers = {}) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type, X-Polling-Client',
    'Access-Control-Expose-Headers': 'Authorization',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  })
  res.end(body)
}

function error(res, status, message) { json(res, status, { error: message }) }

function empty(res, status = 204) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type, X-Polling-Client',
    'Access-Control-Expose-Headers': 'Authorization',
    'Cache-Control': 'no-store',
  })
  res.end()
}

function authorized(req) { return req.headers.authorization === `Bearer ${OPERATOR.token}` }

async function requestJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch { return null }
}

function moveTo(index) {
  const next = parts[index]?.part
  if (!next) return false
  session.session.current_part_id = next.id
  session.session.current_part_position = next.position
  session.session.current_part_role = next.role
  broadcast('part_change')
  return true
}

async function route(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Accept, Authorization, Content-Type, X-Polling-Client',
      'Access-Control-Allow-Methods': 'DELETE, GET, OPTIONS, PATCH, POST, PUT',
    })
    return res.end()
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`)
  const path = url.pathname
  if (await management.handle(req, res, path, url, { json, error, authorized, requestJson })) return
  const presenceRoute = path.match(/^\/s\/(\d+)\/controller_presence(?:\/([a-f\d-]+))?\.json$/i)
  if (presenceRoute) {
    if (!authorized(req)) return error(res, 401, 'Sign in required.')
    const [, id, client] = presenceRoute
    if (id !== String(SESSION_ID) && id !== String(SECOND_SESSION_ID)) return error(res, 404, 'Session not found.')
    if (req.method === 'GET' && !client) return json(res, 200, presenceSnapshot(id, new URL(req.url, `http://${HOST}:${PORT}`).searchParams.get('client_instance_id')))
    if (req.method !== 'PUT' || !client) return error(res, 405, 'Presence method unavailable.')
    if (!/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(client)) return error(res, 400, 'Invalid UUID.')
    const body = await requestJson(req)
    if (!body || Object.keys(body).sort().join(',') !== 'active,sequence' || !Number.isSafeInteger(body.sequence) || body.sequence <= 0 || typeof body.active !== 'boolean') return error(res, 400, 'Invalid presence update.')
    const key = `${id}:${client}`
    const previous = presence.get(key)
    if (!previous || body.sequence > previous.sequence) presence.set(key, { sequence: body.sequence, active: body.active, expires: body.active ? Date.now() + 45000 : 0 })
    return json(res, 200, presenceSnapshot(id, client))
  }
  // Loopback-only synthetic QA controls; these are never part of the reader/API client.
  if (path === '/fixture/explanations' && req.method === 'POST') {
    const input = await requestJson(req)
    const occurrence = parts.find(({ part }) => part.id === session.session.current_part_id).part
    const scenario = input?.scenario
    const items = scenario === 'empty' ? [] : scenario === 'many' ? Array.from({ length: 12 }, (_, i) => ({ ...explanation, id: explanation.id + i }))
      : scenario === 'add' ? [explanation, { ...explanation, id: explanation.id + 1, title: 'Added fixture explanation' }]
      : scenario === 'edit' ? [{ ...explanation, description: 'Edited fixture explanation. Same occurrence, new authored body.' }] : [explanation]
    explanationEdits.set(occurrence.liturgy_part_id, items)
    broadcast('explanation_updated')
    return json(res, 200, explanationResponse())
  }
  if (path === '/fixture/occurrence' && req.method === 'POST') {
    const input = await requestJson(req)
    return moveTo(Number(input?.index)) ? json(res, 200, session) : error(res, 422, 'Unknown fixture occurrence')
  }
  if (path === '/users/sign_in' && req.method === 'POST') {
    const input = await requestJson(req)
    const user = input?.user
    if (user?.email !== OPERATOR.email || user?.password !== OPERATOR.password) return error(res, 401, 'Email or password is incorrect.')
    return json(res, 200, { user: OPERATOR.user }, { Authorization: `Bearer ${OPERATOR.token}` })
  }
  if (path === '/users/sign_out' && req.method === 'DELETE') {
    if (!authorized(req)) return error(res, 401, 'Sign in required.')
    return empty(res)
  }
  if (path === '/s.json') {
    if (!authorized(req)) return error(res, 401, 'Sign in required.')
    if (req.method !== 'GET') return error(res, 405, 'Use GET to list fixture services.')
    const sessions = [...owned].sort((a, b) => String(b.session.date).localeCompare(String(a.session.date)) || b.session.id - a.session.id)
    return json(res, 200, { sessions, page: { limit: 20, has_more: false, next_cursor: null } })
  }

  if (path === '/services.json') return json(res, 200, listed.length ? listed : { message: 'No sessions today' })
  if (path === `/s/${SESSION_ID}.json`) return json(res, 200, session)
  if (path === `/s/${SECOND_SESSION_ID}.json`) return json(res, 200, secondSession)
  if (path === `/s/${SESSION_ID}/parts.json` || path === `/s/${SECOND_SESSION_ID}/parts.json`) return json(res, 200, { parts })
  const partMatch = path.match(new RegExp(`^/s/${SESSION_ID}/parts/(\\d+)\\.json$`))
  if (partMatch) {
    const found = parts.find(({ part }) => part.id === Number(partMatch[1]))
    return found ? json(res, 200, found) : error(res, 404, 'Unknown fixture part')
  }
  if (path === `/s/${SESSION_ID}/explanations/current.json`) return json(res, 200, explanationResponse())
  const explanationMatch = path.match(new RegExp(`^/s/${SESSION_ID}/explanations/(\\d+)\\.json$`))
  if (explanationMatch && Number(explanationMatch[1]) === explanation.id) return json(res, 200, { explanation })
  const control = path.match(new RegExp(`^/s/${SESSION_ID}/(next|prev|set_part|update_status)\\.json$`))
  if (control) {
    if (!authorized(req)) return error(res, 401, 'Sign in required.')
    if (!['POST', 'PATCH'].includes(req.method)) return error(res, 405, 'Use the matching fixture control method.')
    const input = await requestJson(req)
    const current = session.session.current_part_id
    if (typeof input?.expected_part_id === 'number' && input.expected_part_id !== current) return error(res, 409, 'The service already moved on.')
    switch (control[1]) {
      case 'next': if (!moveTo(parts.findIndex(({ part }) => part.id === current) + 1)) return error(res, 422, 'Already at the final fixture part.'); break
      case 'prev': if (!moveTo(parts.findIndex(({ part }) => part.id === current) - 1)) return error(res, 422, 'Already at the first fixture part.'); break
      case 'set_part': if (!moveTo(parts.findIndex(({ part }) => part.id === input?.part_id))) return error(res, 404, 'Unknown fixture part.'); break
      case 'update_status':
        if (typeof input?.status !== 'string') return error(res, 422, 'A status is required.')
        session.session.status = input.status
        session.session.status_message = typeof input.status_message === 'string' ? input.status_message : null
        break
    }
    return empty(res)
  }
  if (req.method !== 'GET') return error(res, 405, 'Fixture endpoint does not accept this method.')
  return error(res, 404, 'Unknown fixture endpoint')
}

const server = http.createServer((req, res) => { void route(req, res).catch(() => error(res, 500, 'Fixture request failed.')) })
let cableServer = null
try {
  // ws is already available in this checkout; keeping this optional makes the
  // HTTP fixture usable from a copied file without adding a dependency.
  const ws = require('ws')
  const WebSocketServer = ws.WebSocketServer ?? ws.Server
  cableServer = new WebSocketServer({ server, path: '/cable' })
  cableServer.on('connection', socket => {
    socket.send(JSON.stringify({ type: 'welcome' }))
    const pingTimer = setInterval(() => {
      if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'ping', message: Date.now() }))
    }, 3000)
    socket.on('close', () => clearInterval(pingTimer))
    socket.on('message', raw => {
      try {
        const frame = JSON.parse(String(raw))
        if (frame.command === 'subscribe' && typeof frame.identifier === 'string') {
          const identifier = JSON.parse(frame.identifier)
          if (identifier.channel === 'SessionChannel' && identifier.id === SESSION_ID) {
            socket.fixtureIdentifier = frame.identifier
            socket.send(JSON.stringify({ identifier: frame.identifier, type: 'confirm_subscription' }))
          } else socket.send(JSON.stringify({ identifier: frame.identifier, type: 'reject_subscription' }))
        }
      } catch { /* Ignore malformed protocol frames. */ }
    })
  })
} catch {
  // HTTP reads remain useful when ws is unavailable; README documents this.
}

server.listen(PORT, HOST, () => {
  console.log(`Mobile reader fixture listening at http://${HOST}:${PORT} (services: ${SCENARIO})`)
  console.log(`ActionCable ${cableServer ? 'enabled at ws://' + HOST + ':' + PORT + '/cable' : 'unavailable (ws package not found)'}`)
})
