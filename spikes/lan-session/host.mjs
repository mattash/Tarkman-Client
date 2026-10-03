// LAN host spike: the controller's role. Advertises the session on Bonjour, serves its current state
// to followers over TCP (newline-delimited JSON), heartbeats, and applies local commands.
//
//   node spikes/lan-session/host.mjs [sessionId]        then press Enter to send "next"
//
// Run follower.mjs on another machine (or terminal) on the same LAN.

import net from 'node:net'
import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline'
import { advertise } from './dnssd.mjs'
import { HEARTBEAT_MS, PROTOCOL_VERSION, SERVICE_TYPE, applyLocal, initialHost, publication } from './protocol.mjs'

/** A tiny manifest standing in for GET /s/:id/parts.json: the host resolves moves against it. */
export const MANIFEST = [1, 2, 3, 4, 5].map(n => ({ partId: 100 + n, liturgyPartId: 200 + n, liturgyId: 7, position: n }))
export function cursorAt(position) {
  const part = MANIFEST.find(p => p.position === position)
  return part ? { partId: part.partId, liturgyPartId: part.liturgyPartId, liturgyId: part.liturgyId, position: part.position } : null
}

export function frame(message) { return `${JSON.stringify(message)}\n` }

/** Start a host for `sessionId`. Resolves to `{ port, instance, host(), next(), prev(), stop() }`. */
export async function startHost({ sessionId = 42, revision = 10, hostId = randomUUID().slice(0, 8), epoch = 1, port = 0, mdnsSocket = null, address } = {}) {
  let host = initialHost({ hostId, epoch, sessionId, revision, contentContext: 'ctx-1',
    state: { cursor: cursorAt(1), status: 'active', message: null, posture: null, date: '2026-10-04' } })
  const sockets = new Set()
  const broadcast = () => { const line = frame(publication(host)); for (const socket of sockets) socket.write(line) }
  const server = net.createServer(socket => {
    sockets.add(socket)
    socket.setNoDelay(true)
    socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket))
    socket.write(frame({ v: PROTOCOL_VERSION, kind: 'hello', role: 'host', hostId, sessionId }))
    socket.write(frame(publication(host)))
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, () => { server.removeListener('error', reject); resolve() }) })
  const listening = server.address().port
  const heartbeat = setInterval(broadcast, HEARTBEAT_MS)
  const txt = () => ({ v: String(PROTOCOL_VERSION), sid: String(sessionId), hid: hostId, ep: String(epoch), base: String(host.base), seq: String(host.log.length) })
  const ad = await advertise({ type: SERVICE_TYPE, name: `Tarkman s${sessionId} ${hostId}`, port: listening, txt: txt(), address }, mdnsSocket)
  const move = delta => {
    const position = (host.state.cursor?.position ?? 0) + delta, cursor = cursorAt(position)
    if (!cursor) return false // past either end: refused locally, as the control screen refuses it today
    host = applyLocal(host, { kind: 'move', cursor, transitionedAt: new Date().toISOString() })
    broadcast(); return true
  }
  return {
    port: listening, instance: ad.instance, host: () => host,
    next: () => move(1), prev: () => move(-1),
    stop() {
      clearInterval(heartbeat); ad.stop()
      for (const socket of sockets) socket.destroy()
      return new Promise(resolve => server.close(() => resolve()))
    },
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''))) {
  const sessionId = Number(process.argv[2] ?? 42)
  const running = await startHost({ sessionId })
  console.log(`hosting session ${sessionId} as ${running.instance} on tcp/${running.port}; Enter = next, p = prev, q = quit`)
  const lines = createInterface({ input: process.stdin })
  for await (const line of lines) {
    if (line.trim() === 'q') break
    const ok = line.trim() === 'p' ? running.prev() : running.next()
    const { base, log, state } = running.host()
    console.log(ok ? `-> base ${base} seq ${log.length} position ${state.cursor.position}` : 'refused: past the end of the service')
  }
  await running.stop(); process.exit(0)
}
