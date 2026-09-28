// Synthetic session-management routes (mattash/Tarkman#454, version 1) for the loopback QA fixture.
// FIXTURE_MANAGEMENT=off serves an older backend without them, to check the unavailable state.
// Nothing here contacts, or stands for, a real parish service.

const ZONE = 'America/Los_Angeles'
const CATALOG = [
  'Divine Liturgy', 'Morning Service', 'Evening Service', 'Blessing of Water', 'Requiem Service', 'Peace Service',
  'Midnight Service', 'Sunrise Service', 'Hymns of the Nativity', 'Service of the Washing of Feet',
].map((name, index) => ({ id: 5001 + index, name, occurrence_count: 12 + index * 3 }))
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000

function today() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = type => parts.find(item => item.type === type).value
  return `${part('year')}-${part('month')}-${part('day')}`
}
function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
const OPTION_KEYS = ['gospel', 'epistle', 'before_message', 'after_message']

function createManagement({ enabled, owned, church, seed = [], onDeleted = () => {} }) {
  let nextId = 9101
  const receipts = new Map()
  const records = new Map()
  const deleted = new Set()
  // Existing fixture sessions become editable records; `current` stands in for the exact current occurrence.
  for (const item of seed) records.set(item.id, { options: { gospel: '', epistle: '', before_message: '', after_message: '' }, status: 'active', revision: 1, current: item.liturgy_ids[0], ...item })

  function snapshot(record) {
    const liturgies = record.liturgy_ids.map((id, index) => {
      const found = CATALOG.find(item => item.id === id)
      return { id, name: found?.name ?? `Retired liturgy ${id}`, position: index + 1, selectable: !!found }
    })
    return { id: record.id, date: record.date, liturgy_ids: [...record.liturgy_ids], liturgies, options: { ...record.options },
      status: record.status, revision: record.revision, current_part_id: null, current_liturgy_part_id: null, cursor: null,
      liturgy: record.title ?? liturgies.map(item => item.name).join(' · '), church_name: church }
  }
  function listed(record) {
    const s = snapshot(record)
    const existing = owned.find(item => item.session.id === s.id)
    return { session: { ...(existing?.session ?? {}), id: s.id, liturgy: s.liturgy, church_name: church, date: s.date, status: s.status, revision: s.revision } }
  }
  function validate(session, partial = false, previous = []) {
    const errors = {}
    if ((!partial || session?.date !== undefined) && !calendarDate(session?.date)) errors.date = ['must be a real calendar date (YYYY-MM-DD)']
    const ids = session?.liturgy_ids
    if (partial && ids === undefined) { /* membership unchanged */ } else if (!Array.isArray(ids) || ids.length === 0) errors.liturgy_ids = ['choose at least one liturgy']
    else if (new Set(ids).size !== ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) errors.liturgy_ids = ['must be distinct liturgy ids']
    else if (ids.some(id => !previous.includes(id) && !CATALOG.some(item => item.id === id))) errors.liturgy_ids = ['includes a liturgy that is not available']
    for (const key of OPTION_KEYS) {
      const value = session?.options?.[key]
      if (value !== undefined && typeof value !== 'string') errors[`options.${key}`] = ['must be text']
      else if (typeof value === 'string' && value.length > 2000) errors[`options.${key}`] = ['is too long (maximum is 2000 characters)']
    }
    return errors
  }

  /** Returns true when the request was a management route this fixture served. */
  async function handle(req, res, path, url, { json, error, authorized, requestJson }) {
    if (!enabled) return false
    const coded = (target, status, code, extra = {}) => json(target, status, { error: code, code, ...extra })
    if (path === '/s/new.json' && req.method === 'GET') {
      if (!authorized(req)) return error(res, 401, 'Sign in required.'), true
      return json(res, 200, { schema_version: 1, session_management_version: 1, time_zone: ZONE,
        defaults: { date: today(), options: { gospel: '', epistle: '', before_message: '', after_message: '' } },
        limits: { max_liturgies: 10, option_max_length: { gospel: 2000, epistle: 2000, before_message: 2000, after_message: 2000 } } }), true
    }
    if (path === '/s/liturgy_options.json' && req.method === 'GET') {
      if (!authorized(req)) return error(res, 401, 'Sign in required.'), true
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50)))
      const after = Number(url.searchParams.get('after_id') ?? 0)
      const query = (url.searchParams.get('q') ?? '').toLowerCase()
      const matches = CATALOG.filter(item => item.id > after && item.name.toLowerCase().includes(query))
      // Per-account usage, as the backend form's by_user_frequency counts it; the client sorts by it.
      const usage = id => [...records.values()].filter(record => record.liturgy_ids.includes(id)).length
      const page = matches.slice(0, limit).map(item => ({ ...item, usage_count: usage(item.id) }))
      return json(res, 200, { schema_version: 1, liturgies: page, next_after_id: matches.length > limit ? page.at(-1).id : null }), true
    }
    if (path === '/s.json' && req.method === 'POST') {
      if (!authorized(req)) return error(res, 401, 'Sign in required.'), true
      const input = await requestJson(req)
      const key = input?.client_request_id
      const fingerprint = JSON.stringify(input?.session ?? null)
      const receipt = typeof key === 'string' ? receipts.get(key) : undefined
      if (receipt && Date.now() - receipt.at < RETRY_WINDOW_MS) {
        if (receipt.fingerprint !== fingerprint) return coded(res, 409, 'idempotency_conflict'), true
        const record = records.get(receipt.id)
        if (!record) return coded(res, 409, 'creation_result_unavailable'), true
        return json(res, 200, { replayed: true, session: snapshot(record) }), true
      }
      const errors = validate(input?.session)
      if (Object.keys(errors).length) return coded(res, 422, 'invalid_session', { errors_by_field: errors }), true
      const options = Object.fromEntries(OPTION_KEYS.map(option => [option, input.session.options?.[option] ?? '']))
      const record = { id: nextId++, date: input.session.date, liturgy_ids: [...input.session.liturgy_ids], options, status: 'active', revision: 1, current: input.session.liturgy_ids[0] }
      records.set(record.id, record)
      owned.push(listed(record))
      if (typeof key === 'string') receipts.set(key, { fingerprint, id: record.id, at: Date.now() })
      const body = { id: record.id, date: record.date, session: snapshot(record) }
      return json(res, 201, body), true
    }
    const member = path.match(/^\/s\/(\d+)(\/edit|\/state|\/parts)?\.json$/)
    if (member && deleted.has(Number(member[1]))) return coded(res, 404, 'session_not_found'), true
    const editRoute = path.match(/^\/s\/(\d+)\/edit\.json$/)
    if (editRoute && req.method === 'GET') {
      if (!authorized(req)) return error(res, 401, 'Sign in required.'), true
      const record = records.get(Number(editRoute[1]))
      return record ? json(res, 200, { schema_version: 1, session: snapshot(record) }) : coded(res, 404, 'session_not_found'), true
    }
    const resource = path.match(/^\/s\/(\d+)\.json$/)
    if (resource && (req.method === 'PATCH' || req.method === 'DELETE')) {
      if (!authorized(req)) return error(res, 401, 'Sign in required.'), true
      const record = records.get(Number(resource[1]))
      if (!record) return coded(res, 404, 'session_not_found'), true
      const input = await requestJson(req)
      if (!Number.isSafeInteger(input?.expected_revision)) return coded(res, 400, 'invalid_precondition'), true
      if (input.expected_revision !== record.revision) return coded(res, 409, 'stale_session', { session: snapshot(record) }), true
      if (req.method === 'DELETE') {
        records.delete(record.id); deleted.add(record.id)
        const at = owned.findIndex(item => item.session.id === record.id)
        if (at >= 0) owned.splice(at, 1)
        onDeleted(record.id, record.revision + 1)
        res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }); res.end()
        return true
      }
      const changes = input.session ?? {}
      const errors = validate(changes, true, record.liturgy_ids)
      if (Object.keys(errors).length) return coded(res, 422, 'invalid_session', { errors_by_field: errors }), true
      const ids = changes.liturgy_ids ?? record.liturgy_ids
      if (!ids.includes(record.current) && input.confirm_cursor_reset !== true) {
        const first = CATALOG.find(item => item.id === ids[0])
        return coded(res, 409, 'cursor_reset_required', { revision: record.revision,
          proposed_cursor: { liturgy_name: first?.name ?? `Liturgy ${ids[0]}`, role: 'priest', position: 1 } }), true
      }
      if (!ids.includes(record.current)) record.current = ids[0]
      if (changes.date !== undefined) record.date = changes.date
      if (changes.liturgy_ids) { record.liturgy_ids = [...changes.liturgy_ids]; delete record.title }
      for (const key of OPTION_KEYS) if (changes.options && typeof changes.options[key] === 'string') record.options[key] = changes.options[key]
      record.revision += 1
      const index = owned.findIndex(item => item.session.id === record.id)
      if (index >= 0) owned[index] = listed(record)
      return json(res, 200, { session: snapshot(record) }), true
    }
    // Loopback-only QA control: another controller moved the session (a new revision), to show a stale save.
    const bump = path.match(/^\/fixture\/sessions\/(\d+)\/bump$/)
    if (bump && req.method === 'POST' && records.has(Number(bump[1]))) {
      records.get(Number(bump[1])).revision += 1
      return json(res, 200, { revision: records.get(Number(bump[1])).revision }), true
    }
    return false
  }
  return { handle, snapshot, records, listed, isDeleted: id => deleted.has(id) }
}

module.exports = { createManagement }
