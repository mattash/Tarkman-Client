import { describe, expect, it, jest } from '@jest/globals'
import { androidReaderLink } from '../features/links/androidReaderLink'
import config from '../app.json'
import { Platform } from 'react-native'
import { redirectSystemPath } from '../app/+native-intent'

describe('Android public reader links', () => {
  it.each([
    ['/sessions/4006/parts', '/sessions/4006/parts'],
    ['/sessions/4006/parts/', '/sessions/4006/parts'],
    ['/sessions/4006/part/2066', '/sessions/4006/part/2066'],
    ['/sessions/4006/part/2066/?key=occurrence-2&role=deacon#en', '/sessions/4006/part/2066?key=occurrence-2&role=deacon#en'],
    ['/sessions/4006/part/2066?id=7&partId=8', '/sessions/4006/part/2066'],
  ])('routes %s without losing reading context', (input, expected) => {
    expect(androidReaderLink(`https://web.tarkman.app${input}`)).toBe(expected)
  })

  it.each([
    '/sessions/display', '/sessions/status/display', '/sessions/4006/display',
    '/sessions/4006/status/display', '/display-links/example',
    '/sessions/0/parts', '/sessions/-1/parts', '/sessions/1e3/parts',
    '/sessions/9007199254740993/parts', '/sessions/4006/part/9007199254740993',
    '/sessions/4006/part/0', '/sessions/4006/part/2066/extra',
    '/sessions/4006%2Fstatus/parts', '/sessions/4006/part/2066%2Fdisplay',
    '/sessions/4006/explanations', '/s/4006/explain',
  ])('does not navigate a malformed or browser-only URL: %s', path => {
    expect(androidReaderLink(`https://web.tarkman.app${path}`)).toBe('/')
  })

  it.each([
    'http://web.tarkman.app/sessions/1/parts',
    'https://other.example/sessions/1/parts',
    'https://web.tarkman.app:444/sessions/1/parts',
    'https://user@web.tarkman.app/sessions/1/parts',
    'https://[broken',
  ])('rejects an unexpected web URL explicitly delivered to the app: %s', url => {
    expect(androidReaderLink(url)).toBe('/')
  })

  it.each(['tarkman://sessions/4006/parts', 'exp+tarkman://expo-development-client/?url=http%3A%2F%2Flocalhost', '/scan'])('preserves existing non-web paths: %s', path => {
    expect(androidReaderLink(path)).toBe(path)
  })

  it('claims only HTTPS reader-shaped paths, retaining the custom scheme', () => {
    expect(config.expo.scheme).toBe('tarkman')
    expect(config.expo.android.intentFilters).toHaveLength(1)
    const filter = config.expo.android.intentFilters[0]
    expect(filter.action).toBe('VIEW')
    expect(filter.autoVerify).toBe(true)
    expect(filter.category).toEqual(['BROWSABLE', 'DEFAULT'])
    expect(filter.data).toEqual([
      { scheme: 'https', host: 'web.tarkman.app', pathPattern: '/sessions/.*/parts' },
      { scheme: 'https', host: 'web.tarkman.app', pathPattern: '/sessions/.*/parts/' },
      { scheme: 'https', host: 'web.tarkman.app', pathPattern: '/sessions/.*/part/.*' },
    ])
  })
})


it('applies the Android guard to cold and warm intents while preserving iOS handling', () => {
  const path = 'https://web.tarkman.app/sessions/9007199254740993/parts'
  const platform = jest.replaceProperty(Platform, 'OS', 'android')
  try {
    expect(redirectSystemPath({ path, initial: true })).toBe('/')
    expect(redirectSystemPath({ path, initial: false })).toBe('/')
    platform.replaceValue('ios')
    expect(redirectSystemPath({ path, initial: true })).toBe(path)
  } finally {
    platform.restore()
  }
})
