#!/usr/bin/env node
/* global console, process, Buffer, setInterval, clearInterval, URL, __dirname */
// Synthetic, loopback-only review fixture. No real service or account is read or changed.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const ws = require('ws')
const WebSocketServer = ws.WebSocketServer || ws.Server
const port = Number(process.env.DISPLAY_FIXTURE_PORT || 8101)
let revision = 1, live = true, sessionId = 9001, index = 1, status = 'active', expired = false, disconnected = false
const clients = new Map()
const prayer = { en: 'Our Father, who art in heaven,\nhallowed be thy name.\n\nThy kingdom come.\nThy will be done,\non earth as it is in heaven.',
  grabar: 'Հայր մեր, որ յերկինս ես,\nսուրբ եղիցի անուն քո։\n\nԵկեսցէ արքայութիւն քո,\nեղիցին կամք քո\nորպէս յերկինս եւ յերկրի։',
  translit: 'Hayr mer, vor hergins yes,\nsurp yeghitsi anun ko.\n\nYegestse arkayutyun ko,\nyeghitsin gamk ko\nvorbes hergins yev hergri.' }
const parts = [0, 1, 2, 3].map(i => ({ part: {
  id: i === 3 ? 902 : 901 + i, liturgy_id: 99, liturgy_part_id: 9901 + i, position: i + 1,
  role: i === 2 ? 'priest' : 'choir', page: [1, 24, 108, 24][i], posture: ['stand', 'stand', 'sit', 'kneel'][i],
  ...Object.fromEntries(Object.entries(prayer).map(([language, text]) => [language, i === 2 ? Array(6).fill(text).join('\n\n') : text])), ru: null,
} }))
function state(id) {
  const p = parts[index].part
  return { id, revision, content_context: 'display-review-v1', status, session_status: status, status_message: 'Please join us for fellowship after the service.\nAll are welcome.', posture: p.posture, date: '2026-09-19',
    cursor: { part_id: p.id, liturgy_part_id: p.liturgy_part_id, liturgy_id: 99, position: p.position } }
}
function session(id) {
  const s = state(id), p = parts[index].part
  return { session: { ...s, liturgy: id === 9001 ? 'Divine Liturgy' : 'Evening Prayer', church_name: 'Sample parish · review fixture',
    current_part_id: p.id, current_liturgy_part_id: p.liturgy_part_id, current_liturgy_id: 99, current_part_position: p.position,
    num_of_parts: parts.length, liturgies: [{ id: 99, position: 1 }], page: p.page,
    options: { before_message: 'Welcome to worship.\nLet us pray together.', after_message: 'Go in peace.\nMay the Lord be with you.',
      gospel: 'The Holy Gospel according to John.\nGlory to You, O Lord our God.', epistle: 'A reading from the letter of Saint Paul to the Romans.' },
  } }
}
function json(res, value, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Polling-Client', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(value))
}
function broadcast() {
  for (const [socket, identifiers] of clients) for (const identifier of identifiers) {
    const id = JSON.parse(identifier).id
    socket.send(JSON.stringify({ identifier, message: { event: 'part_change', data: { ...state(id), session: id, part: parts[index].part.id } } }))
  }
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`)
  if (req.method === 'OPTIONS') return json(res, {})
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(__dirname, 'review.html')))
  }
  if (url.pathname === '/review/state' && req.method === 'POST') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    const change = JSON.parse(Buffer.concat(chunks).toString() || '{}')
    if (typeof change.live === 'boolean') live = change.live
    if ([9001, 9002].includes(change.sessionId)) sessionId = change.sessionId
    if ([0, 1, 2, 3].includes(change.index)) index = change.index
    if (['active', 'paused', 'showing_gospel', 'showing_epistle', 'showing_welcome', 'showing_custom'].includes(change.status)) status = change.status
    if (typeof change.expired === 'boolean') expired = change.expired
    if (typeof change.disconnected === 'boolean') disconnected = change.disconnected
    revision++; broadcast()
    if (disconnected) for (const socket of clients.keys()) socket.close()
    return json(res, { live, sessionId, index, status, revision, expired, disconnected })
  }
  if (url.pathname.startsWith('/display_links/')) {
    const token = url.pathname.split('/').pop()
    if (expired || token === 'invalid') return json(res, {}, 410)
    const views = { pages: 'pages_only', posture: 'posture_only', plain: 'none' }
    return json(res, { token, user_id: 7, mode: token === 'single' ? 'single' : 'parallel', lang1: token === 'missing' ? 'hyw' : 'grabar', lang2: token === 'single' ? null : 'en',
      show_explanations: true, show_notifications: token !== 'quiet', status_view: views[token] || 'full', church_name: 'Sample parish · review fixture' })
  }
  if (/^\/s\/\d+\/current.json$/.test(url.pathname)) return json(res, live ? session(sessionId) : { status: 'inactive' })
  if (url.pathname === '/services.json') return json(res, live ? [session(sessionId)] : { message: 'No current services' })
  const match = url.pathname.match(/^\/s\/(9001|9002)(.*)$/)
  if (match) {
    const id = Number(match[1]), suffix = match[2]
    if (suffix === '.json') return json(res, session(id))
    if (suffix === '/state.json') return json(res, { session: state(id) })
    if (suffix === '/parts.json') return json(res, { parts })
    if (suffix === '/explanations/current.json') return json(res, { explanations: index === 1 ? [{ explanation: { id: 77, title: 'The Lord’s Prayer', description: 'Synthetic explanation for display review.', liturgy_part_id: 9902 } }] : [] })
  }
  return json(res, { error: 'Unknown fixture route' }, 404)
})
const cable = new WebSocketServer({ server, path: '/cable' })
cable.on('connection', socket => {
  if (disconnected) { socket.close(); return }
  clients.set(socket, new Set())
  socket.send(JSON.stringify({ type: 'welcome' }))
  const ping = setInterval(() => { if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'ping', message: Date.now() })) }, 3000)
  socket.on('close', () => { clearInterval(ping); clients.delete(socket) })
  socket.on('message', raw => {
    try {
      const frame = JSON.parse(String(raw))
      if (frame.command === 'subscribe') {
        clients.get(socket).add(frame.identifier)
        socket.send(JSON.stringify({ type: 'confirm_subscription', identifier: frame.identifier }))
      }
      if (frame.command === 'unsubscribe') clients.get(socket).delete(frame.identifier)
    } catch { /* Ignore invalid review frames. */ }
  })
})
server.listen(port, '127.0.0.1', () => console.log(`Synthetic display review: http://127.0.0.1:${port}`))
