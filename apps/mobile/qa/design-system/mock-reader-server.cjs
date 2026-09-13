#!/usr/bin/env node
/* global console, setInterval, clearInterval, Buffer, process */

// Read-only local fixture for native SessionReader design QA.
// Run from the repository root with:
//   node apps/mobile/qa/design-system/mock-reader-server.cjs
// FIXTURE_SERVICES=single (default) | several | none chooses what /services.json lists,
// so the home screen's live, several-live and nothing-live states can each be checked.

const http = require('node:http')
const { URL } = require('node:url')

const HOST = '127.0.0.1'
const PORT = 8100
const SESSION_ID = 9001
const SECOND_SESSION_ID = 9002
const SCENARIO = process.env.FIXTURE_SERVICES || 'single'
const LITURGY_ID = 99001

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
const explanationResponse = { explanations: [{ explanation }] }

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Accept, Content-Type, X-Polling-Client',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function error(res, status, message) { json(res, status, { error: message }) }

function route(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Accept, Content-Type, X-Polling-Client',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    })
    return res.end()
  }
  if (req.method !== 'GET') return error(res, 405, 'Fixture is read-only; only GET and OPTIONS are supported.')

  const path = new URL(req.url, `http://${HOST}:${PORT}`).pathname
  if (path === '/services.json') return json(res, 200, listed.length ? listed : { message: 'No sessions today' })
  if (path === `/s/${SESSION_ID}.json`) return json(res, 200, session)
  if (path === `/s/${SECOND_SESSION_ID}.json`) return json(res, 200, secondSession)
  if (path === `/s/${SESSION_ID}/parts.json` || path === `/s/${SECOND_SESSION_ID}/parts.json`) return json(res, 200, { parts })
  const partMatch = path.match(new RegExp(`^/s/${SESSION_ID}/parts/(\\d+)\\.json$`))
  if (partMatch) {
    const found = parts.find(({ part }) => part.id === Number(partMatch[1]))
    return found ? json(res, 200, found) : error(res, 404, 'Unknown fixture part')
  }
  if (path === `/s/${SESSION_ID}/explanations/current.json`) return json(res, 200, explanationResponse)
  const explanationMatch = path.match(new RegExp(`^/s/${SESSION_ID}/explanations/(\\d+)\\.json$`))
  if (explanationMatch && Number(explanationMatch[1]) === explanation.id) return json(res, 200, { explanation })
  return error(res, 404, 'Unknown fixture endpoint')
}

const server = http.createServer(route)
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
