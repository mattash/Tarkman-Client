const assert = require('node:assert/strict')
const { after, before, beforeEach, test } = require('node:test')
const { spawn } = require('node:child_process')
const path = require('node:path')
const WebSocket = require('ws')

const port = 18101
const origin = `http://127.0.0.1:${port}`
let child

async function request(pathname, options = {}) {
  const response = await fetch(`${origin}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const data = await response.json()
  return { response, data }
}
function post(pathname, value) { return request(pathname, { method: 'POST', body: JSON.stringify(value || {}) }) }
async function events() { return (await request('/qa/log')).data.events }

before(async () => {
  child = spawn(process.execPath, [path.join(__dirname, 'server.cjs')], {
    env: { ...process.env, DISPLAY_FIXTURE_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('fixture did not start')), 5000)
    child.once('exit', code => reject(new Error(`fixture exited ${code}`)))
    child.stdout.on('data', chunk => {
      if (String(chunk).includes(`http://127.0.0.1:${port}`)) { clearTimeout(timeout); resolve() }
    })
  })
})
after(() => child?.kill())
beforeEach(async () => { await post('/qa/reset') })

test('publication scenarios emit deterministic envelopes and recoverable manifests', async () => {
  const contiguous = await post('/qa/publications', { scenario: 'contiguous', index: 2 })
  assert.equal(contiguous.data.revision, 2)
  assert.equal(contiguous.data.emitted.id, '9001')
  assert.equal(contiguous.data.emitted.cursor.liturgy_part_id, 9903)

  const duplicate = await post('/qa/publications', { scenario: 'duplicate' })
  assert.equal(duplicate.data.emitted.revision, 2)

  const gap = await post('/qa/publications', { scenario: 'gap' })
  assert.equal(gap.data.emitted.revision, 4)

  const malformed = await post('/qa/publications', { scenario: 'malformed' })
  assert.equal(malformed.data.emitted.revision, 5)
  assert.equal(malformed.data.emitted.content_context, undefined)

  const mismatch = await post('/qa/publications', { scenario: 'context_mismatch', content_context: 'qa-context-2' })
  assert.equal(mismatch.data.emitted.content_context, 'qa-context-2')

  const unknown = await post('/qa/publications', { scenario: 'unknown_occurrence' })
  assert.equal(unknown.data.emitted.cursor.liturgy_part_id, 9999)
  const manifest = await request('/s/9001/parts.json')
  assert.ok(manifest.data.parts.some(({ part }) => part.liturgy_part_id === 9999))

  const rawEnvelope = { id: '9001', revision: 88, arbitrary: 'exact' }
  const raw = await post('/qa/publications', { scenario: 'raw', envelope: rawEnvelope })
  assert.deepEqual(raw.data.emitted, rawEnvelope)
  const publicationEvents = (await events()).filter(entry => entry.kind === 'publication')
  assert.deepEqual(publicationEvents.at(-1).envelope, rawEnvelope)
})

test('state endpoint modes preserve legacy session fallback and reconciliation data', async () => {
  await post('/qa/config', { stateMode: 'legacy404' })
  assert.equal((await request('/s/9001/state.json')).response.status, 404)
  assert.equal((await request('/s/9001.json')).response.status, 200)

  await post('/qa/config', { stateMode: 'legacy405' })
  assert.equal((await request('/s/9001/state.json')).response.status, 405)

  await post('/qa/config', { stateMode: 'reconciliation', reconciliation: { revision: 77, content_context: 'qa-reconcile', cursor: null } })
  const reconciled = await request('/s/9001/state.json')
  assert.equal(reconciled.data.session.revision, 77)
  assert.equal(reconciled.data.session.content_context, 'qa-reconcile')
  assert.equal(reconciled.data.session.cursor, null)

  const modes = (await events()).filter(entry => entry.kind === 'state').map(entry => entry.mode)
  assert.deepEqual(modes, ['legacy404', 'legacy405', 'reconciliation'])
})

test('refused commands are logged once and metadata recovery precedes the sibling manifest', async () => {
  await post('/qa/config', { commandMode: 'refuse409' })
  const refused = await post('/s/9001/next.json', { expected_part_id: 902, expected_revision: 1 })
  assert.equal(refused.response.status, 409)
  await request('/s/9001.json')
  await request('/s/9001/parts.json')

  const relevant = (await events()).filter(entry => ['command', 'session', 'parts', 'publication'].includes(entry.kind))
  assert.deepEqual(relevant.map(entry => entry.kind), ['command', 'session', 'parts'])
  assert.equal(relevant[0].mode, 'refuse409')
})

test('accepted commands emit one publication and websocket lifecycle is auditable', async () => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/cable`)
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  const identifier = JSON.stringify({ channel: 'SessionChannel', id: '9001' })
  socket.send(JSON.stringify({ command: 'subscribe', identifier }))
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('subscription not confirmed')), 3000)
    socket.on('message', raw => {
      const frame = JSON.parse(String(raw))
      if (frame.type === 'confirm_subscription') { clearTimeout(timeout); resolve() }
    })
  })

  const accepted = await post('/s/9001/next.json', { expected_part_id: 902, expected_revision: 1 })
  assert.equal(accepted.response.status, 200)
  assert.equal(accepted.data.status, 'success')
  const relevant = (await events()).filter(entry => ['websocket.connect', 'websocket.subscribe', 'command', 'publication'].includes(entry.kind))
  assert.deepEqual(relevant.map(entry => entry.kind), ['websocket.connect', 'websocket.subscribe', 'command', 'publication'])
  socket.close()
})

test('fixture remains bound to loopback and reset restores deterministic defaults', async () => {
  await post('/qa/config', { stateMode: 'legacy404', commandMode: 'refuse409' })
  const reset = await post('/qa/reset')
  assert.deepEqual(reset.data.fixture, {
    revision: 1, sessionId: 9001, index: 1, status: 'active', contentContext: 'display-review-v1', stateMode: 'normal', commandMode: 'accept',
  })
  assert.equal((await events())[0].kind, 'qa.reset')
  assert.match(origin, /^http:\/\/127\.0\.0\.1:/)
})
