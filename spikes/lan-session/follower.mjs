// LAN follower spike: a display's role. Browses Bonjour for the session's host, connects, and projects
// the host's publications through the follower reducer (which would also take cloud publications).
//
//   node spikes/lan-session/follower.mjs [sessionId]

import net from 'node:net'
import { createInterface } from 'node:readline'
import { browse } from './dnssd.mjs'
import { SERVICE_TYPE, applyHost, choose, initialFollower, parseLanPublication } from './protocol.mjs'

/**
 * Follow `sessionId` on the LAN. `onChange(follower, reason)` fires on every accepted publication.
 * Resolves to `{ follower(), stop() }` once connected to a host, or rejects after `timeout` ms.
 */
export function startFollower({ sessionId = 42, contentContext = 'ctx-1', onChange = () => {}, timeout = 10000, mdnsSocket = null, now = Date.now } = {}) {
  return new Promise(async (resolve, reject) => {
    let follower = initialFollower(sessionId, contentContext)
    let socket = null, browser = null, settled = false
    const timer = setTimeout(() => { if (!settled) { settled = true; browser?.stop(); reject(new Error(`no host for session ${sessionId} found in ${timeout}ms`)) } }, timeout)
    // Re-evaluate the lease on a timer, so a host that falls silent stops being projected.
    const lease = setInterval(() => {
      const result = choose(follower, now())
      if (result.applied) { follower = result.follower; onChange(follower, 'lease') }
    }, 1000)
    const stop = () => { clearTimeout(timer); clearInterval(lease); browser?.stop(); socket?.destroy() }
    browser = await browse(SERVICE_TYPE, {
      onFound(found) {
        // Only this session's host, and only one connection.
        if (found.txt.sid !== String(sessionId) || socket || !found.address) return
        socket = net.connect(found.port, found.address)
        socket.on('error', error => { if (!settled) { settled = true; stop(); reject(error) } })
        socket.on('close', () => { socket = null })
        const lines = createInterface({ input: socket })
        lines.on('line', line => {
          let message
          try { message = JSON.parse(line) } catch { return }
          if (message.kind === 'hello') { if (!settled) { settled = true; clearTimeout(timer); resolve({ follower: () => follower, found, stop }) } return }
          const publication = parseLanPublication(message)
          if (!publication) return
          const result = applyHost(follower, publication, now())
          follower = result.follower
          if (result.applied) onChange(follower, result.reason)
        })
      },
    }, mdnsSocket).catch(error => { settled = true; clearTimeout(timer); clearInterval(lease); reject(error) })
  })
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''))) {
  const sessionId = Number(process.argv[2] ?? 42)
  console.log(`looking for a host of session ${sessionId} on the LAN…`)
  const running = await startFollower({ sessionId, timeout: 60000, onChange(follower, reason) {
    const { source, shown, host } = follower
    console.log(`[${reason}] source ${source}; base ${host?.base} seq ${host?.seq}; position ${shown?.cursor?.position ?? '-'} status ${shown?.status}`)
  } })
  console.log(`connected to ${running.found.name} at ${running.found.address}:${running.found.port}`)
  process.on('SIGINT', () => { running.stop(); process.exit(0) })
}
