// LAN session protocol spike (mattash/Tarkman-Client#235).
//
// Pure functions only: the ordering key, the follower reducer, the host's provisional command
// log and the replay it produces on reconnect. Nothing here touches the network, so the same
// rules can later move into packages/tarkman-reader unchanged. See docs/lan-session-control.md.

export const PROTOCOL_VERSION = 1
/** Bonjour service type the host advertises and followers browse. */
export const SERVICE_TYPE = '_tarkman._tcp'
/** The host repeats its key this often; a follower treats the host as gone after LEASE_MS of silence. */
export const HEARTBEAT_MS = 5000
export const LEASE_MS = 15000

/**
 * Ordering key of a LAN publication: the cloud revision it builds on, the host's epoch (a new epoch
 * means the host lost its log and is back at `base`), and the provisional command count since `base`.
 * The cloud's own publications are `[revision, 0, 0]`: a cloud revision always outranks the provisional
 * commands that preceded it, and `seq` restarts at 0 whenever a cloud revision is accepted.
 */
export function key(publication) {
  return [publication.base, publication.epoch ?? 0, publication.seq ?? 0]
}
export function compareKeys(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  return 0
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}
function count(value) { return Number.isSafeInteger(value) && value >= 0 }
function id(value) { return Number.isSafeInteger(value) && value > 0 }
function nullableText(value) { return value === null || typeof value === 'string' }

/**
 * Fail closed, like parsePublication in packages/tarkman-reader/src/contracts.ts: a malformed LAN
 * frame is dropped, never patched. Returns the publication or null.
 */
export function parseLanPublication(value) {
  const p = record(value)
  if (!p || p.v !== PROTOCOL_VERSION || p.kind !== 'state') return null
  if (!id(p.sessionId) || typeof p.hostId !== 'string' || !p.hostId || !count(p.epoch) || !count(p.base) || !count(p.seq)) return null
  if (typeof p.contentContext !== 'string' || !p.contentContext) return null
  const s = record(p.state)
  if (!s || typeof s.status !== 'string' || !nullableText(s.message) || !nullableText(s.posture) || !nullableText(s.date)) return null
  let cursor = null
  if (s.cursor !== null) {
    const c = record(s.cursor)
    if (!c || !id(c.partId) || !id(c.liturgyPartId) || !id(c.liturgyId) || !id(c.position)) return null
    cursor = { partId: c.partId, liturgyPartId: c.liturgyPartId, liturgyId: c.liturgyId, position: c.position }
  }
  return { v: 1, kind: 'state', sessionId: p.sessionId, hostId: p.hostId, epoch: p.epoch, base: p.base, seq: p.seq,
    contentContext: p.contentContext, state: { cursor, status: s.status, message: s.message, posture: s.posture, date: s.date } }
}

// ---------------------------------------------------------------------------------------------
// Follower
// ---------------------------------------------------------------------------------------------

/** A follower keeps one view per source. `shown` is what it projects. */
export function initialFollower(sessionId, contentContext) {
  return { sessionId, contentContext, cloud: null, host: null, shown: null, source: 'none' }
}

/**
 * Apply a publication from the host. Rejects other sessions, duplicates and anything not newer than
 * the host view. A different content context means the manifest (parts) changed: the follower must
 * fetch the manifest (from the host, or the cloud) before it can show the cursor, so the publication is
 * held and `needs: 'manifest'` is reported.
 */
export function applyHost(follower, publication, now) {
  if (publication.sessionId !== follower.sessionId) return { follower, applied: false, reason: 'other-session' }
  if (follower.host && compareKeys(key(publication), key(follower.host)) <= 0) {
    // Same key from the same host is the heartbeat: it only refreshes the lease.
    const same = compareKeys(key(publication), key(follower.host)) === 0 && publication.hostId === follower.host.hostId
    return same ? { follower: { ...follower, hostSeenAt: now }, applied: false, reason: 'heartbeat' } : { follower, applied: false, reason: 'stale' }
  }
  if (publication.contentContext !== follower.contentContext) return { follower, applied: false, reason: 'needs-manifest', needs: 'manifest' }
  return choose({ ...follower, host: publication, hostSeenAt: now }, now)
}

/** Apply a cloud publication (`revision` is the cloud's; the key is `[revision, 0, 0]`). */
export function applyCloud(follower, state, now) {
  const publication = { base: state.revision, epoch: 0, seq: 0, state }
  if (follower.cloud && compareKeys(key(publication), key(follower.cloud)) <= 0) return { follower, applied: false, reason: 'stale' }
  if (state.contentContext !== follower.contentContext) return { follower, applied: false, reason: 'needs-manifest', needs: 'manifest' }
  return choose({ ...follower, cloud: publication }, now)
}

/** The host is only an authority while it is heard from. */
export function hostFresh(follower, now) {
  return follower.host != null && follower.hostSeenAt != null && now - follower.hostSeenAt < LEASE_MS
}

/**
 * Which source the follower projects.
 *
 *   1. A fresh host that is at or beyond the cloud revision the follower knows: the host (it relays the
 *      cloud, or it is ahead with provisional commands).
 *   2. A fresh host that is BEHIND the cloud but has provisional commands (seq > 0): still the host.
 *      It is partitioned and the operator in the room is running the service on it; the cloud will win
 *      when the host reconnects and replays (see replay()).
 *   3. A fresh host behind the cloud with no provisional commands: the cloud. The host is merely stale.
 *   4. No fresh host: the cloud, if any; otherwise the last thing shown, marked not live.
 */
export function choose(follower, now) {
  const { host, cloud } = follower
  let source = 'none', shown = follower.shown
  if (hostFresh(follower, now) && (!cloud || host.base >= cloud.base || host.seq > 0)) { source = 'host'; shown = host.state }
  else if (cloud) { source = 'cloud'; shown = cloud.state }
  else if (host) { source = 'host-stale'; shown = host.state }
  const applied = shown !== follower.shown || source !== follower.source
  return { follower: { ...follower, source, shown }, applied, reason: applied ? 'applied' : 'unchanged' }
}

// ---------------------------------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------------------------------

/**
 * The host's provisional log. `base` is the last cloud revision it accepted, `log` the commands applied
 * locally since then, in order. `epoch` changes only when the log is lost (not persisted across a restart).
 */
export function initialHost({ hostId, epoch, sessionId, revision, contentContext, state }) {
  return { hostId, epoch, sessionId, base: revision, contentContext, state, log: [] }
}

/** What the host publishes on the LAN right now (also the heartbeat payload). */
export function publication(host) {
  return { v: PROTOCOL_VERSION, kind: 'state', sessionId: host.sessionId, hostId: host.hostId, epoch: host.epoch,
    base: host.base, seq: host.log.length, contentContext: host.contentContext, state: host.state }
}

/** Idempotency key of one local command, stable across retries and restarts of the replay. */
export function commandId(host, seq) { return `${host.hostId}:${host.epoch}:${host.base}:${seq}` }

/**
 * Apply an operator command locally while the cloud is unreachable. `command` is one of
 * `{ kind: 'move', cursor, transitionedAt }` or `{ kind: 'status', status, message }`. The move's cursor
 * must already be resolved against the manifest (the host has the parts; a move past either end is
 * refused by the caller exactly as the control screen refuses it today).
 */
export function applyLocal(host, command) {
  const seq = host.log.length + 1
  const entry = { ...command, seq, commandId: commandId(host, seq) }
  const state = command.kind === 'move'
    ? { ...host.state, cursor: command.cursor }
    : { ...host.state, status: command.status, message: command.message ?? null }
  return { ...host, state, log: [...host.log, entry] }
}

/** The host accepted a cloud revision (relay, or the result of a replay): the log is settled. */
export function acceptCloud(host, state) {
  if (state.revision < host.base) return host
  return { ...host, base: state.revision, contentContext: state.contentContext, state, log: [] }
}

/**
 * The commands to send to the cloud on reconnect, compressed to what today's endpoints can express:
 * one `set_part` for the final cursor (with the LAST move's transitioned_at) and one `update_status` if
 * the status changed. Every request carries `expected_revision: base`, so a replay that races another
 * controller, or a second attempt after a crash mid-replay, is refused as stale (409) instead of
 * moving the service twice. Intermediate transitions are lost to the server's timing analytics until the
 * backend accepts the full log (phase 2 in the design doc).
 */
export function replay(host) {
  const moves = host.log.filter(entry => entry.kind === 'move')
  const statuses = host.log.filter(entry => entry.kind === 'status')
  const requests = []
  if (moves.length) {
    const last = moves[moves.length - 1]
    requests.push({ path: `/s/${host.sessionId}/set_part.json`, method: 'POST', idempotencyKey: last.commandId,
      body: { part_id: last.cursor.partId, liturgy_part_id: last.cursor.liturgyPartId, transitioned_at: last.transitionedAt, expected_revision: host.base } })
  }
  if (statuses.length) {
    const last = statuses[statuses.length - 1]
    requests.push({ path: `/s/${host.sessionId}/update_status.json`, method: 'PATCH', idempotencyKey: last.commandId,
      body: { status: last.status, status_message: last.message ?? undefined, expected_revision: host.base } })
  }
  return { requests, full: host.log.map(entry => ({ ...entry, expected_revision: host.base })) }
}

/**
 * Outcome of a replay. On success the host takes the cloud's new revision (the log is settled and
 * followers see the same state under a higher key). On 409 the cloud moved while the host was away:
 * the cloud wins, the host resyncs to the cloud state, and the operator is offered the position the
 * room was at so one tap can reassert it. Nothing is retried automatically.
 */
export function settle(host, outcome) {
  if (outcome.kind === 'accepted') return { host: acceptCloud(host, outcome.state), conflict: null }
  if (outcome.kind === 'stale') return { host: acceptCloud(host, outcome.state), conflict: { roomState: host.state, cloudState: outcome.state } }
  return { host, conflict: null, retry: true }
}
