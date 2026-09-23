#!/usr/bin/env node
/* global console, process, Buffer, setInterval, clearInterval, setTimeout, URL, __dirname */
// Synthetic, loopback-only review fixture. No real service or account is read or changed.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const ws = require('ws')
const WebSocketServer = ws.WebSocketServer || ws.Server
const port = Number(process.env.DISPLAY_FIXTURE_PORT || 8101)
const LOOPBACK_ORIGINS = new Set(['http://127.0.0.1:3000', 'http://localhost:3000', 'http://127.0.0.1:8081', 'http://localhost:8081', 'http://127.0.0.1:8082', 'http://localhost:8082'])
const clients = new Map()
let dropConfigEvents = false, rejectConfigChannel = false, failConfigReads = false, mutationStatus = 0, delayMutation = 0
let nextLinkId = 20
const links = new Map()
const editable = ['title', 'device_type', 'mode', 'lang1', 'lang2', 'font_scale', 'status_view', 'show_notifications', 'show_explanations', 'text_movement', 'language_sync', 'margin_percent', 'expires_at']
function newLink(token, id, user_id = 7) {
  return { id, token, user_id, title: token === 'token-A' ? 'Sanctuary A' : token === 'token-B' ? 'Hall B' : `Sample ${id}`,
    config_version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), expires_at: null,
    display_url: `${process.env.DISPLAY_FIXTURE_SHARE_ORIGIN || 'https://localhost:8082'}/sessions/display?token=${encodeURIComponent(token)}`,
    mode: 'parallel', lang1: 'translit', lang2: 'en', device_type: 'auto', font_scale: 100,
    text_movement: 'continuous', language_sync: 'linked', margin_percent: null,
    show_notifications: true, show_explanations: false, status_view: 'full', church_name: 'Sample parish · review fixture' }
}
for (const [index, token] of ['token-A', 'token-B', 'parallel', 'single', 'pages', 'posture', 'plain', 'missing', 'quiet'].entries()) {
  const link = newLink(token, index + 1)
  if (token === 'single') { link.mode = 'single'; link.lang2 = null }
  if (token === 'missing') link.lang1 = 'hyw'
  if (token === 'quiet') link.show_notifications = false
  link.status_view = ({ pages: 'pages_only', posture: 'posture_only', plain: 'none' })[token] || 'full'
  links.set(token, link)
}
links.set('other-owner', newLink('other-owner', 19, 8))
function isExpired(link) { return expired || (link.expires_at && Date.parse(link.expires_at) <= Date.now()) }
function publishLink(link, reason) {
  if (dropConfigEvents) return
  const message = reason ? { event: 'display_link.invalidated', data: { token: link.token, config_version: link.config_version, reason } }
    : { event: 'display_link.updated', data: link }
  for (const [socket, identifiers] of clients) for (const identifier of identifiers) {
    const subscription = JSON.parse(identifier)
    if (subscription.channel === 'DisplayLinkChannel' && subscription.token === link.token && socket.readyState === 1) socket.send(JSON.stringify({ identifier, message }))
  }
}
async function body(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return JSON.parse(Buffer.concat(chunks).toString() || '{}') }
function updateLink(link, fields) {
  Object.assign(link, Object.fromEntries(editable.filter(key => Object.hasOwn(fields, key)).map(key => [key, fields[key]])))
  if (link.mode === 'single') link.lang2 = null
  if (!link.title.trim()) link.title = `Sample display ${link.id}`
  link.config_version++; link.updated_at = new Date().toISOString()
  publishLink(link, isExpired(link) ? 'expired' : undefined)
}
const requestLog = []
let sequence = 0
let revision, live, sessionId, index, status, expired, disconnected, contentContext, extraPart
let stateMode, reconciliationState, commandMode

const prayer = { en: 'Our Father, who art in heaven,\nhallowed be thy name.\n\nThy kingdom come.\nThy will be done,\non earth as it is in heaven.',
  grabar: 'Հայր մեր, որ յերկինս ես,\nսուրբ եղիցի անուն քո։\n\nԵկեսցէ արքայութիւն քո,\nեղիցին կամք քո\nորպէս յերկինս եւ յերկրի։',
  translit: 'Hayr mer, vor hergins yes,\nsurp yeghitsi anun ko.\n\nYegestse arkayutyun ko,\nyeghitsin gamk ko\nvorbes hergins yev hergri.' }
const baseParts = [0, 1, 2, 3].map(i => ({ part: {
  id: i === 3 ? 902 : 901 + i, liturgy_id: 99, liturgy_part_id: 9901 + i, position: i + 1,
  role: i === 2 ? 'priest' : 'choir', page: [1, 24, 108, 24][i], posture: ['stand', 'stand', 'sit', 'kneel'][i],
  effective_duration_ms: i === 2 ? 30000 : 60000,
  ...Object.fromEntries(Object.entries(prayer).map(([language, text]) => [language, i === 2 ? Array(6).fill(text).join('\n\n') : text])), ru: null,
} }))

function resetFixture() {
  revision = 1; live = true; sessionId = 9001; index = 1; status = 'active'; expired = false; disconnected = false
  contentContext = 'display-review-v1'; extraPart = null; stateMode = 'normal'; reconciliationState = null; commandMode = 'accept'
}
resetFixture()
function log(kind, detail = {}) {
  const entry = { sequence: ++sequence, at: new Date().toISOString(), kind, ...detail }
  requestLog.push(entry); return entry
}
function parts() { return extraPart ? [...baseParts, extraPart] : baseParts }
function currentPart() { return extraPart && index === extraPart.part.position - 1 ? extraPart.part : baseParts[index].part }
function state(id, overrides = {}) {
  const p = currentPart()
  return { id, revision, content_context: contentContext, status, session_status: status,
    status_message: 'Please join us for fellowship after the service.\nAll are welcome.', posture: p.posture, date: '2026-09-19',
    cursor: { part_id: p.id, liturgy_part_id: p.liturgy_part_id, liturgy_id: 99, position: p.position }, ...overrides }
}
function session(id) {
  const s = state(id), p = currentPart()
  return { session: { ...s, liturgy: Number(id) === 9001 ? 'Divine Liturgy' : 'Evening Prayer', church_name: 'Sample parish · review fixture',
    current_part_id: p.id, current_liturgy_part_id: p.liturgy_part_id, current_liturgy_id: 99, current_part_position: p.position,
    num_of_parts: parts().length, liturgies: [{ id: 99, position: 1 }], page: p.page,
    options: { before_message: 'Welcome to worship.\nLet us pray together.', after_message: 'Go in peace.\nMay the Lord be with you.',
      gospel: 'The Holy Gospel according to John.\nGlory to You, O Lord our God.', epistle: 'A reading from the letter of Saint Paul to the Romans.' } } }
}
function json(res, value, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Polling-Client', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS, HEAD', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(value))
}

function cableEnvelope(identifierId, overrides = {}) { return { ...state(String(identifierId)), session: String(identifierId), part: currentPart().id, ...overrides } }
function broadcastEnvelope(envelope, event = 'part_change') {
  for (const [socket, identifiers] of clients) for (const identifier of identifiers) {
    const subscription = JSON.parse(identifier)
    if (subscription.channel !== 'SessionChannel' || Number(subscription.id) !== Number(envelope.session)) continue
    if (socket.readyState === 1) socket.send(JSON.stringify({ identifier, message: { event, data: envelope } }))
  }
  log('publication', { event, envelope })
}
function broadcastCurrent() {
  let emitted = null
  for (const [socket, identifiers] of clients) for (const identifier of identifiers) {
    const subscription = JSON.parse(identifier)
    if (subscription.channel !== 'SessionChannel') continue
    const envelope = cableEnvelope(subscription.id)
    emitted ||= envelope
    if (socket.readyState === 1) socket.send(JSON.stringify({ identifier, message: { event: 'part_change', data: envelope } }))
  }
  emitted ||= cableEnvelope(sessionId)
  log('publication', { event: 'part_change', envelope: emitted })
  return emitted
}
function setIndex(value) {
  if ([0, 1, 2, 3].includes(value)) { index = value; extraPart = null; return true }
  if (extraPart && value === extraPart.part.position - 1) { index = value; return true }
  return false
}
function unknownOccurrence() {
  const source = baseParts[0].part
  return { part: { ...source, liturgy_part_id: 9999, position: 5, page: 999, role: 'QA unknown occurrence', en: 'Synthetic recovered occurrence.', effective_duration_ms: 5000 } }
}
function applyReviewChange(change) {
  if (typeof change.live === 'boolean') live = change.live
  if ([9001, 9002].includes(change.sessionId)) sessionId = change.sessionId
  setIndex(change.index)
  if (['active', 'paused', 'showing_gospel', 'showing_epistle', 'showing_welcome', 'showing_custom'].includes(change.status)) status = change.status
  if (typeof change.expired === 'boolean') expired = change.expired
  if (typeof change.disconnected === 'boolean') disconnected = change.disconnected
}
function commandResponse() {
  const current = state(sessionId)
  return { status: 'success', current_part_id: current.cursor.part_id, revision: current.revision,
    content_context: current.content_context, cursor: current.cursor, session_status: current.session_status,
    status_message: current.status_message, posture: current.posture, date: current.date }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`)
  const origin = req.headers.origin
  if (LOOPBACK_ORIGINS.has(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); res.setHeader('Vary', 'Origin') }
  if (req.method === 'OPTIONS') return json(res, {})
  if (url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(__dirname, 'review.html'))) }

  if (url.pathname === '/qa/reset' && req.method === 'POST') {
    resetFixture(); requestLog.length = 0; sequence = 0
    const entry = log('qa.reset')
    return json(res, { ok: true, entry, fixture: { revision, sessionId, index, status, contentContext, stateMode, commandMode } })
  }
  if (url.pathname === '/users/sign_in' && req.method === 'POST') {
    const data = await body(req)
    if (data.user?.email !== 'operator@display.test' || data.user?.password !== 'fixture') return json(res, { error: 'Fixture credentials required' }, 401)
    return json(res, { token: 'display-fixture-account', user: { id: 7, name: 'Display reviewer', email: 'operator@display.test', roles: ['admin'] } })
  }
  if (url.pathname === '/users/sign_out') return json(res, {})
  if (url.pathname === '/review/config' && req.method === 'POST') {
    const data = await body(req), link = links.get(data.token || 'token-A')
    if (typeof data.dropEvents === 'boolean') dropConfigEvents = data.dropEvents
    if (typeof data.rejectChannel === 'boolean') rejectConfigChannel = data.rejectChannel
    if (typeof data.failReads === 'boolean') failConfigReads = data.failReads
    mutationStatus = data.mutationStatus ?? mutationStatus
    delayMutation = data.delayMutation ?? delayMutation
    if (link && data.fields) updateLink(link, data.fields)
    if (link && data.delete) { link.config_version++; publishLink(link, 'deleted'); links.delete(link.token) }
    return json(res, { ok: true })
  }
  if (url.pathname === '/display_links' && req.method === 'GET') {
    if (req.headers.authorization !== 'Bearer display-fixture-account') return json(res, {}, 401)
    if (url.searchParams.get('scope') !== 'mine') return json(res, { error: 'scope=mine required' }, 400)
    return json(res, [...links.values()].filter(link => link.user_id === 7).reverse())
  }
  if ((url.pathname === '/display_links' && req.method === 'POST') || (url.pathname.startsWith('/display_links/') && req.method === 'PATCH')) {
    if (req.headers.authorization !== 'Bearer display-fixture-account') return json(res, {}, 401)
    const data = await body(req), fields = data.display_link || {}, creating = req.method === 'POST'
    const link = creating ? newLink(`created-${nextLinkId}`, nextLinkId++) : links.get(decodeURIComponent(url.pathname.split('/').pop()))
    if (!link) return json(res, {}, 404)
    if (link.user_id !== 7) return json(res, {}, 403)
    if (mutationStatus) return json(res, {}, mutationStatus)
    if (!creating && data.expected_config_version !== link.config_version) return json(res, { error: 'stale_display_link', current_config_version: link.config_version, display_link: link }, 409)
    const errors = {}
    if (fields.font_scale !== undefined && (!Number.isInteger(fields.font_scale) || fields.font_scale < 50 || fields.font_scale > 200)) errors.font_scale = ['Use 50–200 percent.']
    if (fields.margin_percent !== undefined && fields.margin_percent !== null && (!Number.isInteger(fields.margin_percent) || fields.margin_percent < 0 || fields.margin_percent > 15)) errors.margin_percent = ['Use 0–15 percent or automatic.']
    if ((fields.mode || link.mode) === 'parallel' && (Object.hasOwn(fields, 'lang2') ? fields.lang2 : link.lang2) === null) errors.lang2 = ['Choose a second language.']
    if (Object.keys(errors).length) return json(res, { errors: Object.values(errors).flat(), errors_by_field: errors }, 422)
    if (creating) link.config_version = 0
    updateLink(link, fields); links.set(link.token, link)
    if (delayMutation) await new Promise(resolve => setTimeout(resolve, delayMutation))
    return json(res, link, creating ? 201 : 200)
  }
  if (url.pathname === '/qa/log' && req.method === 'GET') return json(res, { events: requestLog })
  if (url.pathname === '/qa/status' && req.method === 'GET') return json(res, { revision, sessionId, index, status, contentContext, stateMode, commandMode, disconnected, clients: clients.size })
  if (url.pathname === '/qa/config' && req.method === 'POST') {
    const change = await body(req)
    if (['normal', 'reconciliation', 'legacy404', 'legacy405'].includes(change.stateMode)) stateMode = change.stateMode
    if (['accept', 'refuse409'].includes(change.commandMode)) commandMode = change.commandMode
    if (change.reconciliation && typeof change.reconciliation === 'object') reconciliationState = change.reconciliation
    const entry = log('qa.config', { stateMode, commandMode, reconciliationState })
    return json(res, { ok: true, entry, stateMode, commandMode, reconciliationState })
  }
  if (url.pathname === '/qa/publications' && req.method === 'POST') {
    const request = await body(req), scenario = request.scenario || 'contiguous'
    if (Number.isInteger(request.index)) setIndex(request.index)
    let emitted
    if (scenario === 'raw') emitted = request.envelope
    else if (scenario === 'duplicate') emitted = cableEnvelope(sessionId)
    else if (scenario === 'gap') { revision += 2; emitted = cableEnvelope(sessionId) }
    else if (scenario === 'malformed') { revision += 1; emitted = { id: String(sessionId), session: String(sessionId), revision, cursor: state(sessionId).cursor } }
    else if (scenario === 'context_mismatch') { revision += 1; contentContext = request.content_context || `display-review-v${revision}`; emitted = cableEnvelope(sessionId) }
    else if (scenario === 'unknown_occurrence') { revision += 1; extraPart = unknownOccurrence(); index = extraPart.part.position - 1; emitted = cableEnvelope(sessionId) }
    else { revision += 1; emitted = cableEnvelope(sessionId) }
    broadcastEnvelope(emitted, request.event || 'part_change')
    return json(res, { scenario, emitted, revision, content_context: contentContext })
  }
  if (url.pathname === '/review/state' && req.method === 'POST') {
    const change = await body(req)
    applyReviewChange(change)
    if (typeof change.expired === 'boolean') {
      for (const link of links.values()) { link.config_version++; publishLink(link, expired ? 'expired' : undefined) }
    }
    revision++
    const emitted = broadcastCurrent()
    if (disconnected) for (const socket of clients.keys()) socket.close()
    return json(res, { live, sessionId, index, status, revision, expired, disconnected, emitted })
  }
  if (url.pathname.startsWith('/display_links/')) {
    if (failConfigReads) return json(res, {}, 503)
    const link = links.get(decodeURIComponent(url.pathname.split('/').pop()))
    if (!link) return json(res, {}, 404)
    if (isExpired(link)) return json(res, {}, 410)
    return json(res, link)
  }
  if (/^\/s\/\d+\/current.json$/.test(url.pathname)) return json(res, live ? session(sessionId) : { status: 'inactive' })
  if (url.pathname === '/services.json') return json(res, live ? [session(sessionId)] : { message: 'No current services' })

  const match = url.pathname.match(/^\/s\/(9001|9002)(.*)$/)
  if (match) {
    const id = Number(match[1]), suffix = match[2]
    const isCommand = ['/next.json', '/prev.json', '/set_part.json', '/update_status.json'].includes(suffix)
    if (isCommand && ['POST', 'PATCH'].includes(req.method)) {
      const request = await body(req)
      const attempt = log('command', { method: req.method, path: url.pathname, request, mode: commandMode })
      if (commandMode === 'refuse409') return json(res, { error: 'The current part changed', current_part_id: currentPart().id, attempt_sequence: attempt.sequence }, 409)
      if (suffix === '/next.json') {
        if (index >= parts().length - 1) return json(res, { status: 'Could not advance session', current_part_id: currentPart().id }, 422)
        index += 1
      } else if (suffix === '/prev.json') {
        if (index <= 0) return json(res, { status: 'Could not back session', current_part_id: currentPart().id }, 422)
        index -= 1
      } else if (suffix === '/set_part.json') {
        const requested = request.liturgy_part_id == null
          ? parts().find(({ part }) => part.id === request.part_id)
          : parts().find(({ part }) => part.liturgy_part_id === request.liturgy_part_id)
        if (requested) index = requested.part.position - 1
      } else if (suffix === '/update_status.json' && typeof request.status === 'string') status = request.status
      revision += 1
      const response = commandResponse(), emitted = broadcastCurrent()
      return json(res, { ...response, emitted })
    }
    if (suffix === '.json') { log('session', { method: req.method, path: url.pathname }); return json(res, session(id)) }
    if (suffix === '/state.json') {
      log('state', { method: req.method, path: url.pathname, mode: stateMode })
      if (stateMode === 'legacy404') return json(res, {}, 404)
      if (stateMode === 'legacy405') return json(res, {}, 405)
      return json(res, { session: stateMode === 'reconciliation' ? state(id, reconciliationState || {}) : state(id) })
    }
    if (suffix === '/parts.json') { log('parts', { method: req.method, path: url.pathname }); return json(res, { parts: parts() }) }
    if (suffix === '/explanations/current.json') return json(res, { explanations: index === 1 ? [{ explanation: { id: 77, title: 'The Lord’s Prayer', description: 'Synthetic explanation for display review.', liturgy_part_id: 9902 } }] : [] })
  }
  return json(res, { error: 'Unknown fixture route' }, 404)
})

const cable = new WebSocketServer({ server, path: '/cable' })
cable.on('connection', socket => {
  log('websocket.connect')
  if (disconnected) { log('websocket.disconnect', { reason: 'fixture-disconnected' }); socket.close(); return }
  clients.set(socket, new Set()); socket.send(JSON.stringify({ type: 'welcome' }))
  const ping = setInterval(() => { if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'ping', message: Date.now() })) }, 3000)
  socket.on('close', () => { clearInterval(ping); clients.delete(socket); log('websocket.disconnect') })
  socket.on('message', raw => {
    try {
      const frame = JSON.parse(String(raw))
      if (frame.command === 'subscribe') {
        const subscription = JSON.parse(frame.identifier)
        if (subscription.channel === 'DisplayLinkChannel') {
          const link = links.get(subscription.token)
          if (rejectConfigChannel || !link || isExpired(link)) { socket.send(JSON.stringify({ type: 'reject_subscription', identifier: frame.identifier })); return }
        }
        clients.get(socket).add(frame.identifier)
        log('websocket.subscribe', { identifier: subscription })
        socket.send(JSON.stringify({ type: 'confirm_subscription', identifier: frame.identifier }))
      }
      if (frame.command === 'unsubscribe') {
        const subscription = JSON.parse(frame.identifier)
        clients.get(socket).delete(frame.identifier)
        log('websocket.unsubscribe', { identifier: subscription })
      }
    } catch (error) { log('websocket.invalid', { error: String(error) }) }
  })
})
server.listen(port, '127.0.0.1', () => console.log(`Synthetic display review: http://127.0.0.1:${server.address().port}`))
