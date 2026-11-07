import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

/** Local static server for the rendered linked-scroll validation harness. */
export function createLinkedScrollServer(dist) {
  return http.createServer((req, res) => {
    let pathname
    try {
      pathname = decodeURIComponent(req.url.split('?')[0])
    } catch (error) {
      if (!(error instanceof URIError)) throw error
      res.writeHead(400); res.end(); return
    }
    let file = path.join(dist, pathname)
    if (!file.startsWith(`${dist}/`)) { res.writeHead(400); res.end(); return }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html')
    res.setHeader('content-type', ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.woff2': 'font/woff2' })[path.extname(file)] || 'application/octet-stream')
    res.end(fs.readFileSync(file))
  })
}
