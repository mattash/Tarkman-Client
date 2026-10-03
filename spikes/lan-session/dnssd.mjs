// Minimal mDNS / DNS-SD (RFC 6762 / 6763) for the LAN spike: enough to advertise one `_tarkman._tcp`
// instance and to browse for it, in plain Node (dgram), with no dependencies.
//
// This is for the spike and for a possible dedicated LAN box. On iOS and tvOS the apps must use the
// system Bonjour APIs (NWListener / NWBrowser): sending raw mDNS from an app needs the multicast
// entitlement, while Bonjour does not. See docs/lan-session-control.md, "Platform limits".

import dgram from 'node:dgram'
import os from 'node:os'

export const MDNS_ADDRESS = '224.0.0.251'
export const MDNS_PORT = 5353
const TYPE = { A: 1, PTR: 12, TXT: 16, SRV: 33 }
const CLASS_IN = 1, CACHE_FLUSH = 0x8000

// --- encoding ---------------------------------------------------------------------------------

function encodeName(name) {
  const parts = []
  for (const label of name.replace(/\.$/, '').split('.')) {
    const bytes = Buffer.from(label, 'utf8')
    if (bytes.length > 63) throw new Error(`label too long: ${label}`)
    parts.push(Buffer.from([bytes.length]), bytes)
  }
  parts.push(Buffer.from([0]))
  return Buffer.concat(parts)
}
function encodeTxt(txt) {
  const parts = Object.entries(txt).map(([k, v]) => {
    const bytes = Buffer.from(`${k}=${v}`, 'utf8')
    if (bytes.length > 255) throw new Error(`txt entry too long: ${k}`)
    return Buffer.concat([Buffer.from([bytes.length]), bytes])
  })
  return parts.length ? Buffer.concat(parts) : Buffer.from([0])
}
function rdata(record) {
  switch (record.type) {
    case 'PTR': return encodeName(record.data)
    case 'TXT': return encodeTxt(record.data)
    case 'A': return Buffer.from(record.data.split('.').map(Number))
    case 'SRV': {
      const head = Buffer.alloc(6)
      head.writeUInt16BE(record.data.priority ?? 0, 0); head.writeUInt16BE(record.data.weight ?? 0, 2); head.writeUInt16BE(record.data.port, 4)
      return Buffer.concat([head, encodeName(record.data.target)])
    }
    default: throw new Error(`unsupported type ${record.type}`)
  }
}
function encodeRecord(record) {
  const data = rdata(record), fixed = Buffer.alloc(10)
  fixed.writeUInt16BE(TYPE[record.type], 0)
  fixed.writeUInt16BE(CLASS_IN | (record.flush ? CACHE_FLUSH : 0), 2)
  fixed.writeUInt32BE(record.ttl ?? 120, 4)
  fixed.writeUInt16BE(data.length, 8)
  return Buffer.concat([encodeName(record.name), fixed, data])
}
function encodeQuestion(question) {
  const fixed = Buffer.alloc(4)
  fixed.writeUInt16BE(TYPE[question.type], 0); fixed.writeUInt16BE(CLASS_IN, 2)
  return Buffer.concat([encodeName(question.name), fixed])
}
/** `{ questions?: [{name,type}], answers?: [record], additionals?: [record] }` to a wire packet. */
export function encode({ id = 0, response = false, questions = [], answers = [], additionals = [] }) {
  const header = Buffer.alloc(12)
  header.writeUInt16BE(id, 0)
  header.writeUInt16BE(response ? 0x8400 : 0, 2) // QR, AA
  header.writeUInt16BE(questions.length, 4); header.writeUInt16BE(answers.length, 6); header.writeUInt16BE(0, 8); header.writeUInt16BE(additionals.length, 10)
  return Buffer.concat([header, ...questions.map(encodeQuestion), ...answers.map(encodeRecord), ...additionals.map(encodeRecord)])
}

// --- decoding ---------------------------------------------------------------------------------

function readName(buffer, offset, depth = 0) {
  const labels = []
  let end = null
  for (;;) {
    if (offset >= buffer.length) throw new Error('truncated name')
    const length = buffer[offset]
    if (length === 0) { offset++; break }
    if ((length & 0xc0) === 0xc0) {
      if (depth > 16) throw new Error('compression loop')
      const pointer = ((length & 0x3f) << 8) | buffer[offset + 1]
      if (end === null) end = offset + 2
      const target = readName(buffer, pointer, depth + 1)
      labels.push(target.name); break
    }
    labels.push(buffer.toString('utf8', offset + 1, offset + 1 + length))
    offset += 1 + length
  }
  return { name: labels.filter(Boolean).join('.'), offset: end ?? offset }
}
function readRecord(buffer, offset) {
  const { name, offset: afterName } = readName(buffer, offset)
  const typeCode = buffer.readUInt16BE(afterName), klass = buffer.readUInt16BE(afterName + 2), ttl = buffer.readUInt32BE(afterName + 4), length = buffer.readUInt16BE(afterName + 8)
  const start = afterName + 10, end = start + length
  if (end > buffer.length) throw new Error('truncated record')
  const type = Object.keys(TYPE).find(k => TYPE[k] === typeCode)
  let data = buffer.subarray(start, end)
  if (type === 'PTR') data = readName(buffer, start).name
  else if (type === 'A') data = [...data].join('.')
  else if (type === 'SRV') data = { priority: data.readUInt16BE(0), weight: data.readUInt16BE(2), port: data.readUInt16BE(4), target: readName(buffer, start + 6).name }
  else if (type === 'TXT') {
    const txt = {}
    for (let i = 0; i < data.length;) {
      const n = data[i], entry = data.toString('utf8', i + 1, i + 1 + n), eq = entry.indexOf('=')
      if (eq > 0) txt[entry.slice(0, eq)] = entry.slice(eq + 1)
      i += 1 + n
    }
    data = txt
  }
  return { record: { name, type: type ?? typeCode, flush: !!(klass & CACHE_FLUSH), ttl, data }, offset: end }
}
/** A wire packet to `{ id, response, questions, answers, additionals }`; throws on a malformed packet. */
export function decode(buffer) {
  if (buffer.length < 12) throw new Error('short packet')
  const id = buffer.readUInt16BE(0), flags = buffer.readUInt16BE(2)
  const counts = [4, 6, 8, 10].map(i => buffer.readUInt16BE(i))
  let offset = 12
  const questions = []
  for (let i = 0; i < counts[0]; i++) {
    const { name, offset: after } = readName(buffer, offset)
    const typeCode = buffer.readUInt16BE(after)
    questions.push({ name, type: Object.keys(TYPE).find(k => TYPE[k] === typeCode) ?? typeCode })
    offset = after + 4
  }
  const sections = []
  for (const count of counts.slice(1)) {
    const records = []
    for (let i = 0; i < count; i++) { const { record, offset: after } = readRecord(buffer, offset); records.push(record); offset = after }
    sections.push(records)
  }
  return { id, response: !!(flags & 0x8000), questions, answers: sections[0], authorities: sections[1], additionals: sections[2] }
}

// --- sockets ------------------------------------------------------------------------------------

/** First non-internal IPv4 address, or loopback. */
export function localAddress() {
  for (const list of Object.values(os.networkInterfaces())) for (const a of list) if (a.family === 'IPv4' && !a.internal) return a.address
  return '127.0.0.1'
}

/** One multicast socket joined to the mDNS group. Resolves once bound; rejects when multicast is unavailable. */
export function openMulticast() {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    socket.once('error', reject)
    socket.bind(MDNS_PORT, () => {
      try { socket.addMembership(MDNS_ADDRESS); socket.setMulticastTTL(255); socket.setMulticastLoopback(true) } catch (error) { socket.close(); reject(error); return }
      socket.removeListener('error', reject)
      resolve(socket)
    })
  })
}

/**
 * Advertise one service instance: `{ type: '_tarkman._tcp', name, port, txt, host?, address? }`.
 * Announces on start, answers PTR queries for the type (and the service enumeration meta-query),
 * and sends a goodbye (TTL 0) on stop. Returns `{ stop }`.
 */
export async function advertise(service, socket = null) {
  const own = socket === null
  socket ??= await openMulticast()
  const typeName = `${service.type}.local`, instance = `${service.name}.${typeName}`
  const host = service.host ?? `${os.hostname().split('.')[0]}.local`, address = service.address ?? localAddress()
  const records = ttl => ({
    answers: [{ name: typeName, type: 'PTR', ttl, data: instance }],
    additionals: [
      { name: instance, type: 'SRV', flush: true, ttl, data: { port: service.port, target: host } },
      { name: instance, type: 'TXT', flush: true, ttl, data: service.txt ?? {} },
      { name: host, type: 'A', flush: true, ttl, data: address },
    ],
  })
  const send = (packet, port = MDNS_PORT, to = MDNS_ADDRESS) => socket.send(packet, port, to, () => {})
  const announce = ttl => send(encode({ response: true, ...records(ttl) }))
  const onMessage = (message, remote) => {
    let packet
    try { packet = decode(message) } catch { return }
    if (packet.response) return
    const asked = packet.questions.some(q => q.type === 'PTR' && (q.name === typeName || q.name === '_services._dns-sd._udp.local'))
    if (!asked) return
    const reply = packet.questions.some(q => q.name === '_services._dns-sd._udp.local')
      ? encode({ id: packet.id, response: true, answers: [{ name: '_services._dns-sd._udp.local', type: 'PTR', ttl: 4500, data: typeName }, ...records(120).answers], additionals: records(120).additionals })
      : encode({ id: packet.id, response: true, ...records(120) })
    // Legacy unicast queries (source port != 5353) get a unicast reply; multicast otherwise.
    if (remote.port !== MDNS_PORT) send(reply, remote.port, remote.address)
    else send(reply)
  }
  socket.on('message', onMessage)
  announce(120)
  const repeat = setTimeout(() => announce(120), 1000)
  return {
    instance,
    stop() {
      clearTimeout(repeat)
      socket.removeListener('message', onMessage)
      announce(0)
      if (own) setTimeout(() => socket.close(), 50)
    },
  }
}

/**
 * Browse for instances of a type. `onFound({ name, host, port, address, txt })` fires once per instance
 * (again if its SRV/TXT/A changes), `onGone(name)` on a goodbye. Returns `{ stop }`.
 */
export async function browse(type, { onFound, onGone = () => {}, interval = 1000 } = {}, socket = null) {
  const own = socket === null
  socket ??= await openMulticast()
  const typeName = `${type}.local`
  const seen = new Map()
  const query = () => socket.send(encode({ questions: [{ name: typeName, type: 'PTR' }] }), MDNS_PORT, MDNS_ADDRESS, () => {})
  const onMessage = message => {
    let packet
    try { packet = decode(message) } catch { return }
    if (!packet.response) return
    const all = [...packet.answers, ...packet.additionals]
    for (const ptr of all.filter(r => r.type === 'PTR' && r.name === typeName)) {
      const instance = ptr.data
      if (ptr.ttl === 0) { if (seen.delete(instance)) onGone(instance); continue }
      const srv = all.find(r => r.type === 'SRV' && r.name === instance), txt = all.find(r => r.type === 'TXT' && r.name === instance)
      if (!srv) continue
      const a = all.find(r => r.type === 'A' && r.name === srv.data.target)
      const found = { name: instance, host: srv.data.target, port: srv.data.port, address: a?.data ?? null, txt: txt?.data ?? {} }
      const fingerprint = JSON.stringify(found)
      if (seen.get(instance) === fingerprint) continue
      seen.set(instance, fingerprint)
      onFound(found)
    }
  }
  socket.on('message', onMessage)
  query()
  const timer = setInterval(query, interval)
  return {
    stop() {
      clearInterval(timer)
      socket.removeListener('message', onMessage)
      if (own) socket.close()
    },
  }
}
