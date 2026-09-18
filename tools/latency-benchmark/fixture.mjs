import https from 'node:https'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

// Local synthetic delays validate attribution, not production performance.
export function startFixture({ port = 8100, partsDelay = 80, postDelay = 120, broadcastDelay = 0 } = {}) {
  const dir = fileURLToPath(new URL('./certs/', import.meta.url))
  mkdirSync(dir, { recursive: true })
  if (!existsSync(`${dir}key.pem`)) execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${dir}key.pem`, '-out', `${dir}cert.pem`, '-days', '2', '-subj', '/CN=localhost'], { stdio: 'ignore' })
  let position = 2
  const parts = [1, 2, 3, 4].map(n => ({ part: { id: 900 + n, liturgy_part_id: 99000 + n, liturgy_id: n < 3 ? 99 : 100,
    position: n, role: n % 2 ? 'choir' : 'priest', posture: n % 2 ? 'sit' : 'stand',
    en: `Local benchmark reading ${n}.\nThis fixture is synthetic.`, grabar: 'Հայր մեր, որ յերկինս ես։', ru: 'Отче наш, сущий на небесах!', translit: 'Hayr mer, vor hergins yes.' } }))
  const session = () => ({ session: { id: 4008, user_id: 1, liturgy: 'Latency benchmark fixture', church_name: 'Local fixture',
    current_part_id: 900 + position, current_part_position: position, current_liturgy_id: position < 3 ? 99 : 100,
    num_of_parts: parts.length, status: 'active', date: new Date().toISOString().slice(0, 10) } })
  function json(res, code, body) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(body)) }
  const server = https.createServer({ key: readFileSync(`${dir}key.pem`), cert: readFileSync(`${dir}cert.pem`) }, async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8101')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('X-Tarkman-Benchmark', '1')
    if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }
    const path = new URL(req.url, 'https://localhost').pathname
    if (req.method === 'GET') {
      if (path === '/s/4008.json') return json(res, 200, session())
      if (path === '/services.json') return json(res, 200, [session()])
      if (path === '/s.json') return json(res, 200, { sessions: [session()] })
      if (path === '/s/4008/parts.json') return setTimeout(() => json(res, 200, { parts }), partsDelay)
      if (path === '/s/4008/explanations/current.json') return json(res, 200, { explanations: [] })
    }
    let body = ''
    for await (const chunk of req) body += chunk
    let data
    try { data = JSON.parse(body || '{}') } catch { return json(res, 400, {}) }
    if (path === '/users/sign_in') return json(res, 200, { token: 'local-fixture-only', user: { id: 1, email: 'benchmark@example.test', name: 'Benchmark', roles: ['admin'] } })
    if (req.method === 'POST' && /^\/s\/4008\/(next|prev)\.json$/.test(path)) {
      if (req.headers.authorization !== 'Bearer local-fixture-only') return json(res, 401, {})
      if (data.expected_part_id !== 900 + position) return json(res, 409, { current_part_id: 900 + position })
      const next = position + (path.includes('/next') ? 1 : -1)
      if (next < 1 || next > parts.length) return json(res, 422, {})
      position = next
      const target = 900 + position
      const benchmark = { run: req.headers['x-tarkman-benchmark-run'], command: req.headers['x-tarkman-benchmark-command'],
        client: req.headers['x-tarkman-benchmark-client'], session_id: 4008 }
      setTimeout(() => {
        for (const socket of cable.clients) if (socket.identifier && socket.readyState === 1) socket.send(JSON.stringify({ identifier: socket.identifier,
          message: { event: 'part_change', data: { session: 4008, part: target }, benchmark } }))
      }, broadcastDelay)
      return setTimeout(() => json(res, 200, { current_part_id: target }), postDelay)
    }
    json(res, 404, {})
  })
  const cable = new WebSocketServer({ server, path: '/cable' })
  cable.on('connection', socket => {
    socket.send(JSON.stringify({ type: 'welcome' }))
    socket.on('message', raw => {
      const message = JSON.parse(String(raw))
      if (message.command === 'subscribe') {
        socket.identifier = message.identifier
        socket.send(JSON.stringify({ type: 'confirm_subscription', identifier: message.identifier }))
      }
    })
  })
  const ping = setInterval(() => { for (const socket of cable.clients) if (socket.readyState === 1) socket.send(JSON.stringify({ type: 'ping', message: Date.now() })) }, 3000)
  server.listen(port, 'localhost', () => console.log(`Synthetic API/cable: https://localhost:${port}, session 4008`))
  return { close() { clearInterval(ping); for (const socket of cable.clients) socket.terminate(); cable.close(); server.close() } }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) startFixture()
