import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../../..')
const read = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))

describe('apple-app-site-association', () => {
  const association = read('apps/mobile/public/.well-known/apple-app-site-association')
  const details = association.applinks.details
  const patterns: string[] = details.flatMap((detail: { components: { '/': string }[] }) => detail.components.map(component => component['/']))

  it('claims this site for the iOS app that ships from this repository', () => {
    const mobile = read('apps/mobile/app.json').expo
    expect(details).toHaveLength(1)
    // The Apple team owning the app record; the bundle identifier must stay in step with the Expo config.
    expect(details[0].appIDs).toEqual([`FHF872BAQR.${mobile.ios.bundleIdentifier}`])
    expect(mobile.ios.associatedDomains).toContain('applinks:web.tarkman.app')
  })

  it('opens only the reading routes the app actually has', () => {
    expect(patterns).toEqual(['/sessions/*/parts', '/sessions/*/part/*'])
  })

  it('leaves the church display routes to the website', () => {
    // Kiosk screens must keep opening in the browser, never in someone's phone app.
    for (const display of ['/sessions/4006/display', '/sessions/display', '/sessions/status/display']) {
      expect(patterns.some(pattern => new RegExp(`^${pattern.replaceAll('*', '[^/]+')}$`).test(display))).toBe(false)
    }
  })

  it('is served as JSON, which Apple requires', () => {
    const header = read('vercel.json').headers.find((entry: { source: string }) => entry.source === '/.well-known/apple-app-site-association')
    expect(header.headers).toContainEqual({ key: 'Content-Type', value: 'application/json' })
  })
})
