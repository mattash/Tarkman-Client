#!/usr/bin/env node

// Hermetic read-only fixture for the first participant reading design trial.
// Run with: node docs/design-system/evidence/web-trial/mock-read-server.js
// Point Vite at it with: VITE_API_URL=http://127.0.0.1:8096

const http = require('node:http')
const { URL } = require('node:url')

const HOST = '127.0.0.1'
const PORT = 8096
const SESSION_ID = 'design-trial'
const LITURGY_ID = 9001

const prayer = {
  grabar: 'Հայր մեր, որ յերկինս ես,\nսուրբ եղիցի անուն քո։\n\nԵկեսցէ արքայութիւն քո,\nեղիցին կամք քո որպէս յերկինս եւ յերկրի։',
  en: 'Our Father, who art in heaven,\nhallowed be thy name.\n\nThy kingdom come. Thy will be done,\non earth as it is in heaven.',
  ru: 'Отче наш, сущий на небесах!\nДа святится имя Твоё.\n\nДа приидет Царствие Твоё;\nда будет воля Твоя и на земле, как на небе.',
  translit: 'Hayr mer, vor hergins yes,\nsurp yeghitsi anun ko.\n\nYegestse arkayutyun ko,\nyeghitsin gamk ko vorbes hergins yev hergri.',
}

const longGrabar = Array.from({ length: 4 }, () => prayer.grabar).join('\n\n')
const explanation = {
  id: 7001,
  title: 'Sample explanation',
  description: 'This is clearly marked sample content for reading layout review.',
  part_ids: [101, 102, 103],
  created_at: '2026-09-12T00:00:00Z',
  updated_at: '2026-09-12T00:00:00Z',
  row_order: 1,
  liturgy_id: LITURGY_ID,
  user_id: 0,
  summary: 'Fixture explanation for the design trial.',
  status: 1,
  tags: ['sample'],
}

function makePart(id, position, overrides = {}) {
  return {
    part: {
      id,
      // Distinct occurrence IDs deliberately repeat the same prayer content.
      liturgy_part_id: 9100 + position,
      role: position === 3 ? 'choir' : 'priest',
      grabar: position === 3 ? longGrabar : prayer.grabar,
      translit: prayer.translit,
      en: prayer.en,
      ru: prayer.ru,
      hy_east: null,
      hy_west: null,
      posture: 'stand',
      sheet_music: null,
      duration_type: 'default',
      page: position,
      explanation_ids: [7001],
      effective_duration_ms: 5000,
      position,
      assignment: null,
      ...overrides,
    },
  }
}

const parts = [
  makePart(101, 1),
  // Explicit missing-Russian translation example for language fallback/layout QA.
  makePart(102, 2, { ru: null }),
  makePart(103, 3),
]

const session = {
  session: {
    id: SESSION_ID,
    liturgy: 'Design trial · Divine Liturgy sample',
    liturgy_id: LITURGY_ID,
    current_liturgy_id: LITURGY_ID,
    liturgies: [{ id: LITURGY_ID, name: 'Design trial · Divine Liturgy sample', position: 1 }],
    date: '2026-09-12',
    church_name: 'Tarkman design trial (fixture)',
    church_avatar: '',
    occupied: false,
    num_of_parts: parts.length,
    current_part_position: 1,
    current_part_id: 101,
    page: 1,
    posture: 'stand',
    readings: { gospel: '', epistle: '' },
    options: { gospel: '', epistle: '', before_message: '', after_message: '' },
    status: 'active',
    status_message: 'Sample content · fixture only',
  },
}

const explanationResponse = { explanations: [{ explanation }] }

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'Access-Control-Allow-Origin': 'http://127.0.0.1:8095',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function empty(res, status, message) {
  json(res, status, { error: message })
}

function route(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': 'http://127.0.0.1:8095',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    })
    return res.end()
  }
  if (req.method !== 'GET') return empty(res, 405, 'Fixture is read-only')

  const path = new URL(req.url, `http://${HOST}:${PORT}`).pathname
  if (path === `/s/${SESSION_ID}.json`) return json(res, 200, session)
  if (path === `/s/${SESSION_ID}/parts.json`) return json(res, 200, { parts })
  const partMatch = path.match(new RegExp(`^/s/${SESSION_ID}/parts/(\\d+)\\.json$`))
  if (partMatch) {
    const found = parts.find(({ part }) => part.id === Number(partMatch[1]))
    return found ? json(res, 200, found) : empty(res, 404, 'Unknown fixture part')
  }
  if (path === `/s/${SESSION_ID}/explanations/current.json` || path === `/s/${SESSION_ID}/explanations/upcoming.json`) return json(res, 200, explanationResponse)
  const explanationMatch = path.match(new RegExp(`^/s/${SESSION_ID}/explanations/(\\d+)\\.json$`))
  if (explanationMatch && Number(explanationMatch[1]) === explanation.id) return json(res, 200, { explanation })
  if (path === `/users/me.json` || path === `/users/current.json`) return json(res, 200, { user: null })
  return empty(res, 404, 'Unknown fixture endpoint')
}

http.createServer(route).listen(PORT, HOST, () => {
  console.log(`Web trial read fixture listening at http://${HOST}:${PORT}`)
})
