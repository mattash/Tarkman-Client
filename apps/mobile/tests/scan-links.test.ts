import { expect, it } from '@jest/globals'
import { readScannedLink } from '../features/scan/links'

it('opens the service a printed code points at', () => {
  expect(readScannedLink('https://www.tarkman.app/s/4006/explain'))
    .toEqual({ kind: 'service', sessionId: 4006, path: '/sessions/4006/parts' })
  expect(readScannedLink('https://tarkman.app/s/4006/explain/')).toMatchObject({ kind: 'service', sessionId: 4006 })
  expect(readScannedLink('  https://www.tarkman.app/s/4006/explain  ')).toMatchObject({ kind: 'service' })
})

it('opens reading links from the website', () => {
  expect(readScannedLink('https://web.tarkman.app/sessions/4006/parts'))
    .toEqual({ kind: 'service', sessionId: 4006, path: '/sessions/4006/parts' })
  expect(readScannedLink('https://web.tarkman.app/sessions/4006/part/2066'))
    .toEqual({ kind: 'part', sessionId: 4006, partId: 2066, path: '/sessions/4006/part/2066' })
})

it('refuses anything that is not a Tarkman reading link', () => {
  for (const hostile of [
    'https://tarkman.app.evil.example/s/4006/explain',
    'https://evil.example/s/4006/explain',
    'https://www.tarkman.app.evil.example/sessions/4006/parts',
    'http://www.tarkman.app/s/4006/explain',
    'javascript:alert(1)',
    'https://user:pass@www.tarkman.app/s/4006/explain',
    'https://www.tarkman.app/sessions/4006/display',
    'https://www.tarkman.app/admin',
    'https://www.tarkman.app/s/0/explain',
    'https://www.tarkman.app/s/-1/explain',
    'https://www.tarkman.app/s/abc/explain',
    'not a url at all',
    '',
  ]) {
    expect(readScannedLink(hostile)).toEqual({ kind: 'unknown' })
  }
})

it('ignores case in the host, as a scanner may report it either way', () => {
  expect(readScannedLink('https://WWW.TARKMAN.APP/s/4006/explain')).toMatchObject({ kind: 'service' })
})
