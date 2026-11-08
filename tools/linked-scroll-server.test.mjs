import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createLinkedScrollServer } from './linked-scroll-server.mjs'

function request(server, pathname) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: pathname }, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { body += chunk })
      response.on('end', () => resolve({ status: response.statusCode, body, contentType: response.headers['content-type'] }))
      response.on('error', reject)
    }).on('error', reject)
  })
}

test('validation server rejects malformed percent escapes and keeps serving', async t => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'linked-scroll-server-'))
  t.after(() => fs.rmSync(dist, { recursive: true, force: true }))
  fs.writeFileSync(path.join(dist, 'index.html'), '<html>fixture</html>')
  fs.writeFileSync(path.join(dist, 'some file.js'), 'window.fixture = true')
  const server = createLinkedScrollServer(dist)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))

  for (const pathname of ['/%E0%A4%A', '/%', '/%GG', '/%C0%AF']) {
    await t.test(pathname, async () => {
      assert.equal((await request(server, pathname)).status, 400)
      assert.deepEqual(await request(server, '/sessions/259/display?token=fixture259'), {
        status: 200, body: '<html>fixture</html>', contentType: 'text/html',
      })
    })
  }

  await t.test('valid encoded asset and query retain existing behavior', async () => {
    assert.deepEqual(await request(server, '/some%20file.js?ignored=%'), {
      status: 200, body: 'window.fixture = true', contentType: 'application/javascript',
    })
  })
  await t.test('encoded parent traversal remains rejected', async () => {
    assert.equal((await request(server, '/%2e%2e/outside.js')).status, 400)
  })
})
