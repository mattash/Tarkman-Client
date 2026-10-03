import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decode, encode, openMulticast } from './dnssd.mjs'
import { LEASE_MS, acceptCloud, applyCloud, applyHost, applyLocal, choose, compareKeys, initialFollower, initialHost, key, parseLanPublication, publication, replay, settle } from './protocol.mjs'
import { startHost, cursorAt } from './host.mjs'
import { startFollower } from './follower.mjs'

const state = (position, extra = {}) => ({ cursor: cursorAt(position), status: 'active', message: null, posture: null, date: '2026-10-04', ...extra })
const cloud = (revision, position, contentContext = 'ctx-1') => ({ ...state(position), revision, contentContext })
function host(revision = 10) {
  return initialHost({ hostId: 'h1', epoch: 1, sessionId: 42, revision, contentContext: 'ctx-1', state: state(1) })
}

test('ordering: a cloud revision outranks the provisional commands before it; a new epoch outranks an old one at the same base', () => {
  assert.equal(compareKeys(key({ base: 10, epoch: 1, seq: 5 }), key({ base: 11, epoch: 0, seq: 0 })), -1)
  assert.equal(compareKeys(key({ base: 10, epoch: 1, seq: 5 }), key({ base: 10, epoch: 2, seq: 0 })), -1)
  assert.equal(compareKeys(key({ base: 10, epoch: 1, seq: 5 }), key({ base: 10, epoch: 1, seq: 4 })), 1)
})

test('parseLanPublication fails closed', () => {
  const good = publication(host())
  assert.deepEqual(parseLanPublication(JSON.parse(JSON.stringify(good))), good)
  assert.equal(parseLanPublication({ ...good, v: 2 }), null)
  assert.equal(parseLanPublication({ ...good, seq: -1 }), null)
  assert.equal(parseLanPublication({ ...good, contentContext: '' }), null)
  assert.equal(parseLanPublication({ ...good, state: { ...good.state, cursor: { partId: 1 } } }), null)
  assert.equal(parseLanPublication({ ...good, state: { ...good.state, cursor: null } })?.state.cursor, null)
})

test('follower: relayed cloud state, then provisional commands, in order, duplicates and stale frames ignored', () => {
  let f = initialFollower(42, 'ctx-1')
  let h = host(10)
  let r = applyHost(f, publication(h), 0)
  assert.equal(r.applied, true); assert.equal(r.follower.source, 'host'); assert.equal(r.follower.shown.cursor.position, 1)
  f = r.follower
  h = applyLocal(h, { kind: 'move', cursor: cursorAt(2), transitionedAt: 't1' })
  const p2 = publication(h)
  r = applyHost(f, p2, 1000); f = r.follower
  assert.equal(f.shown.cursor.position, 2); assert.equal(f.host.seq, 1)
  // A heartbeat (same key) refreshes the lease without a change.
  r = applyHost(f, p2, 2000); assert.equal(r.applied, false); assert.equal(r.reason, 'heartbeat'); assert.equal(r.follower.hostSeenAt, 2000)
  // An older frame (reordered delivery) is dropped.
  r = applyHost(f, publication(host(10)), 2000); assert.equal(r.reason, 'stale')
  // Another session's frame is dropped.
  r = applyHost(f, { ...p2, sessionId: 43 }, 2000); assert.equal(r.reason, 'other-session')
})

test('follower: a changed content context holds the publication until the manifest is fetched', () => {
  const f = initialFollower(42, 'ctx-1')
  const r = applyHost(f, { ...publication(host()), contentContext: 'ctx-2' }, 0)
  assert.equal(r.applied, false); assert.equal(r.needs, 'manifest')
  assert.equal(applyCloud(f, cloud(11, 3, 'ctx-2'), 0).needs, 'manifest')
})

test('follower: source choice between a fresh host and the cloud', () => {
  let f = initialFollower(42, 'ctx-1')
  // Host relays base 10; the cloud publishes 11: the host is merely stale (seq 0), so the cloud wins.
  f = applyHost(f, publication(host(10)), 0).follower
  f = applyCloud(f, cloud(11, 3), 0).follower
  assert.equal(f.source, 'cloud'); assert.equal(f.shown.cursor.position, 3)
  // The host catches up to 11 and relays it: the host is preferred again.
  f = applyHost(f, publication(acceptCloud(host(10), cloud(11, 3))), 0).follower
  assert.equal(f.source, 'host')
  // Partition: the host makes provisional moves at base 11 while the cloud moves on to 12.
  let h = applyLocal(acceptCloud(host(10), cloud(11, 3)), { kind: 'move', cursor: cursorAt(4), transitionedAt: 't' })
  f = applyHost(f, publication(h), 0).follower
  f = applyCloud(f, cloud(12, 2), 0).follower
  assert.equal(f.source, 'host', 'the room follows its operator while the host is partitioned'); assert.equal(f.shown.cursor.position, 4)
  // The host falls silent: after the lease, the follower drops to the cloud.
  const dropped = choose(f, LEASE_MS + 1)
  assert.equal(dropped.applied, true); assert.equal(dropped.follower.source, 'cloud'); assert.equal(dropped.follower.shown.cursor.position, 2)
  // No cloud at all and a silent host: the last state stays, marked stale.
  let lone = initialFollower(42, 'ctx-1')
  lone = applyHost(lone, publication(h), 0).follower
  assert.equal(choose(lone, LEASE_MS + 1).follower.source, 'host-stale')
})

test('LAN-first: the room moves on the tap; the cloud accepting it is invisible; a 409 snaps the room to the cloud once', () => {
  let f = initialFollower(42, 'ctx-1')
  let h = host(10)
  f = applyHost(f, publication(h), 0).follower
  // Tap: provisional frame reaches the follower before any cloud reply.
  h = applyLocal(h, { kind: 'move', cursor: cursorAt(2), transitionedAt: 't1' })
  let r = applyHost(f, publication(h), 10)
  assert.equal(r.applied, true); assert.equal(r.follower.shown.cursor.position, 2); f = r.follower
  // The cloud accepts: same content under [11, 0, 0]. Nothing visible happens on the follower.
  const accepted = settle(h, { kind: 'accepted', state: cloud(11, 2) }); h = accepted.host
  r = applyHost(f, publication(h), 20)
  assert.equal(r.applied, false); assert.equal(r.reason, 'unchanged'); assert.equal(r.follower.host.base, 11); f = r.follower
  // Next tap is refused by the cloud because the service moved elsewhere: the room snaps to the cloud, once.
  h = applyLocal(h, { kind: 'move', cursor: cursorAt(3), transitionedAt: 't2' })
  f = applyHost(f, publication(h), 30).follower
  assert.equal(f.shown.cursor.position, 3)
  const refused = settle(h, { kind: 'stale', state: cloud(13, 5) }); h = refused.host
  r = applyHost(f, publication(h), 40)
  assert.equal(r.applied, true); assert.equal(r.follower.shown.cursor.position, 5); assert.equal(r.follower.host.seq, 0)
  assert.equal(refused.conflict.roomState.cursor.position, 3)
  // No reply at all: the provisional frame stands and the log keeps growing (the fallback, with no mode switch).
  h = applyLocal(h, { kind: 'move', cursor: cursorAt(4), transitionedAt: 't3' })
  assert.equal(settle(h, { kind: 'failed' }).retry, true); assert.equal(h.log.length, 1)
})

test('host: the log compresses to one set_part and one update_status with expected_revision = base', () => {
  let h = host(10)
  h = applyLocal(h, { kind: 'move', cursor: cursorAt(2), transitionedAt: 't1' })
  h = applyLocal(h, { kind: 'move', cursor: cursorAt(3), transitionedAt: 't2' })
  h = applyLocal(h, { kind: 'status', status: 'paused', message: 'Sermon' })
  h = applyLocal(h, { kind: 'move', cursor: cursorAt(4), transitionedAt: 't3' })
  assert.equal(publication(h).seq, 4)
  assert.deepEqual(h.log.map(e => e.commandId), ['h1:1:10:1', 'h1:1:10:2', 'h1:1:10:3', 'h1:1:10:4'])
  const { requests, full } = replay(h)
  assert.equal(full.length, 4)
  assert.deepEqual(requests.map(r => r.path), ['/s/42/set_part.json', '/s/42/update_status.json'])
  assert.deepEqual(requests[0].body, { part_id: 104, liturgy_part_id: 204, transitioned_at: 't3', expected_revision: 10 })
  assert.equal(requests[0].idempotencyKey, 'h1:1:10:4')
  assert.deepEqual(requests[1].body, { status: 'paused', status_message: 'Sermon', expected_revision: 10 })
  assert.deepEqual(replay(host()).requests, [], 'nothing to replay when the host only relayed')
})

test('host: settling a replay. Accepted settles the log under the new revision; 409 means the cloud wins and the room position is offered back', () => {
  let h = applyLocal(host(10), { kind: 'move', cursor: cursorAt(3), transitionedAt: 't' })
  const accepted = settle(h, { kind: 'accepted', state: cloud(11, 3) })
  assert.equal(accepted.conflict, null); assert.equal(accepted.host.base, 11); assert.equal(accepted.host.log.length, 0)
  assert.equal(compareKeys(key(publication(accepted.host)), key(publication(h))), 1, 'followers see the settled state under a higher key')
  const stale = settle(h, { kind: 'stale', state: cloud(12, 5) })
  assert.equal(stale.host.base, 12); assert.equal(stale.host.state.cursor.position, 5, 'the host resyncs to the cloud')
  assert.equal(stale.conflict.roomState.cursor.position, 3, 'the operator can reassert the room position in one tap')
  assert.equal(settle(h, { kind: 'failed' }).retry, true)
  assert.equal(acceptCloud(h, cloud(9, 1)).base, 10, 'an older cloud revision never regresses the host')
})

test('dns-sd: encode/decode round trip, including a compressed name', () => {
  const packet = encode({ response: true,
    answers: [{ name: '_tarkman._tcp.local', type: 'PTR', ttl: 120, data: 'Tarkman s42 h1._tarkman._tcp.local' }],
    additionals: [
      { name: 'Tarkman s42 h1._tarkman._tcp.local', type: 'SRV', flush: true, ttl: 120, data: { port: 4242, target: 'phone.local' } },
      { name: 'Tarkman s42 h1._tarkman._tcp.local', type: 'TXT', flush: true, ttl: 120, data: { v: '1', sid: '42', base: '10', seq: '0' } },
      { name: 'phone.local', type: 'A', flush: true, ttl: 120, data: '192.168.1.20' },
    ] })
  const decoded = decode(packet)
  assert.equal(decoded.response, true)
  assert.deepEqual(decoded.answers[0], { name: '_tarkman._tcp.local', type: 'PTR', flush: false, ttl: 120, data: 'Tarkman s42 h1._tarkman._tcp.local' })
  assert.deepEqual(decoded.additionals[0].data, { priority: 0, weight: 0, port: 4242, target: 'phone.local' })
  assert.deepEqual(decoded.additionals[1].data, { v: '1', sid: '42', base: '10', seq: '0' })
  assert.equal(decoded.additionals[2].data, '192.168.1.20')
  // A hand-built packet with a compression pointer: question "a.local", answer name = pointer to it.
  const name = Buffer.from([1, 0x61, 5, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0])
  const header = Buffer.alloc(12); header.writeUInt16BE(0x8400, 2); header.writeUInt16BE(1, 4); header.writeUInt16BE(1, 6)
  const question = Buffer.concat([name, Buffer.from([0, 1, 0, 1])])
  const answer = Buffer.concat([Buffer.from([0xc0, 12]), Buffer.from([0, 1, 0, 1, 0, 0, 0, 60, 0, 4, 10, 0, 0, 1])])
  const compressed = decode(Buffer.concat([header, question, answer]))
  assert.equal(compressed.answers[0].name, 'a.local'); assert.equal(compressed.answers[0].data, '10.0.0.1')
  assert.throws(() => decode(Buffer.alloc(3)))
})

test('end to end on this machine: a follower discovers the host over mDNS and receives one cursor update', async t => {
  let socket
  try { socket = await openMulticast(); socket.close() } catch (error) { t.skip(`multicast unavailable here: ${error.message}`); return }
  const changes = []
  const running = await startHost({ sessionId: 4242, revision: 10, hostId: 'spike', address: '127.0.0.1' })
  let follower
  try {
    follower = await startFollower({ sessionId: 4242, timeout: 8000, onChange: (f, reason) => changes.push([reason, f.source, f.shown.cursor.position]) })
    assert.equal(follower.found.txt.sid, '4242'); assert.equal(follower.found.port, running.port)
    await new Promise(r => setTimeout(r, 50))
    assert.deepEqual(changes.at(-1), ['applied', 'host', 1], 'the initial state arrived on connect')
    assert.equal(running.next(), true)
    await new Promise(r => setTimeout(r, 100))
    assert.deepEqual(changes.at(-1), ['applied', 'host', 2], 'the cursor update arrived')
    assert.equal(follower.follower().host.seq, 1); assert.equal(follower.follower().host.base, 10)
    assert.equal(running.prev(), true); assert.equal(running.prev(), false, 'a move before the first part is refused locally')
  } finally {
    follower?.stop(); await running.stop()
  }
})
