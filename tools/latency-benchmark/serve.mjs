import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'

const root = resolve(process.argv[2] || '../../apps/mobile/dist')
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' }
http.createServer(async (req, res) => {
  try {
    const path = resolve(root, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`)
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return }
    let data, file = path
    try { data = await readFile(file) } catch {
      if (extname(path)) { res.writeHead(404).end(); return }
      file = resolve(root, 'index.html'); data = await readFile(file)
    }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data)
  } catch { res.writeHead(400).end() }
}).listen(8101, 'localhost', () => console.log(`Expo export: http://localhost:8101 (${root})`))
