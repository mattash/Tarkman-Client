/* global process, URL, console */
// Loopback-only SPA host for actual Expo exports; no production endpoints.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(process.argv[2])
const port = Number(process.argv[3] || 8082)
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json' }
http.createServer((req, res) => {
  const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '')
  let file = path.resolve(root, relative)
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html')
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
  fs.createReadStream(file).pipe(res)
}).listen(port, '127.0.0.1', () => console.log(`Expo export ${root} at http://127.0.0.1:${port}`))
