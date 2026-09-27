/** Local synthetic API for independent QA. Never proxies or contacts production. */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const directory = new URL('../tests/fixtures/public_liturgies/', import.meta.url)
const fixture = name => JSON.parse(readFileSync(new URL(`${name}.json`, directory), 'utf8'))
const scenario = process.argv.find(a => a.startsWith('--scenario='))?.split('=')[1] ?? 'normal'
const port = Number(process.env.LIBRARY_FIXTURE_PORT ?? 4190)
const allowed = ['normal', 'empty', 'partial', 'error', 'updated', 'unavailable', 'slow', 'invalid', 'unconfigured', 'long', 'large']
if (!allowed.includes(scenario)) throw new Error(`Unknown scenario: ${scenario}`)
function bundleFor(id) {
  const bundle = fixture(scenario === 'updated' ? 'bundle_updated' : 'bundle')
  if (scenario === 'long') {
    bundle.parts[0].text.grabar = Array(200).fill('Խաղաղություն։').join(' ')
  }
  if (scenario === 'large') {
    bundle.parts = Array.from({ length: 10 }, (_, i) => ({ ...bundle.parts[0], liturgy_part_id: 10000 + i, position: i + 1, text: { ...bundle.parts[0].text, en: 'Peace '.repeat(120000) } }))
  }
  if (id === 702) {
    bundle.liturgy.id = id; bundle.liturgy.name = 'Synthetic second service'
    for (const p of bundle.parts) {
      p.liturgy_id = id; p.liturgy_part_id += 1000
      for (const e of p.explanations) { e.id += 1000; e.liturgy_part_id = p.liturgy_part_id }
    }
  }
  if (id === 702 || scenario === 'long' || scenario === 'large') {
    delete bundle.revision
    bundle.revision = createHash('sha256').update(JSON.stringify(bundle)).digest('hex')
  }
  return bundle
}
createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'If-None-Match, Accept')
  res.setHeader('Access-Control-Expose-Headers', 'ETag')
  res.setHeader('Cache-Control', 'private, no-cache')
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  const send = (code, body) => { res.writeHead(code); res.end(JSON.stringify(body)) }
  if (scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 25000))
  if (scenario === 'error') { send(503, { error: 'synthetic failure' }); return }
  if (url.pathname === '/public/liturgies.json') {
    if (scenario === 'empty' || (scenario === 'unconfigured' && url.searchParams.get('recommended') === 'true')) { send(200, fixture('catalog_empty')); return }
    let ids = [701, 702].filter(id => id > Number(url.searchParams.get('after_id') ?? 0))
    const next = scenario === 'partial' && ids.length > 1 ? ids[0] : null
    if (next) ids = ids.slice(0, 1)
    const liturgies = ids.map(id => {
      const bundle = bundleFor(id)
      return { ...fixture('catalog').liturgies[0], ...bundle.liturgy, revision: bundle.revision, occurrence_count: bundle.parts.length, download_bytes: Buffer.byteLength(JSON.stringify(bundle)), recommended_rank: id - 700 }
    })
    send(200, { schema_version: 1, liturgies, next_after_id: next }); return
  }
  const match = url.pathname.match(/^\/public\/liturgies\/(701|702)\/download.json$/)
  if (match) {
    if (scenario === 'unavailable') { send(404, fixture('public_liturgy_unavailable')); return }
    if (scenario === 'invalid') { send(200, { schema_version: 99 }); return }
    const bundle = bundleFor(Number(match[1]))
    res.setHeader('ETag', `"${bundle.revision}"`)
    if (req.headers['if-none-match'] === `"${bundle.revision}"`) { res.writeHead(304); res.end(); return }
    send(200, bundle); return
  }
  send(404, { error: 'route not found' })
}).listen(port, '127.0.0.1', () => console.log(`Synthetic library ${scenario}: http://127.0.0.1:${port}`))
