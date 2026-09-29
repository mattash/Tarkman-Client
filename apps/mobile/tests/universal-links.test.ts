import { describe, expect, it } from '@jest/globals'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../..')
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

describe('android asset links', () => {
  const association = read('apps/mobile/public/.well-known/assetlinks.json')

  it('associates this Android app with both Play signing certificates', () => {
    const mobile = read('apps/mobile/app.json').expo
    expect(association).toEqual([{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: mobile.android.package,
        sha256_cert_fingerprints: [
          '1F:64:9E:59:72:81:85:07:1A:7D:E1:33:DD:A9:AD:D5:19:52:07:4E:97:7D:A6:D1:83:36:45:68:BF:A3:FC:30',
          '1D:24:05:04:F7:93:87:6D:5D:53:8A:7A:C0:EF:38:13:7B:F6:55:7A:8B:27:BD:9F:E4:1D:0A:0E:B6:38:2C:23',
        ],
      },
    }])
  })

  it('serves the association without an HTML content type', () => {
    const header = read('vercel.json').headers.find((entry: { source: string }) => entry.source === '/.well-known/assetlinks.json')
    expect(header.headers).toContainEqual({ key: 'Content-Type', value: 'application/json' })
  })
})

describe('legacy Vite paths', () => {
  const redirects: { source: string, destination: string, permanent: boolean }[] = read('vercel.json').redirects

  // Mirrors Vercel's path-to-regexp matching for the patterns used in vercel.json.
  function follow(path: string): string | undefined {
    for (const { source, destination } of redirects) {
      const names: string[] = []
      const pattern = source.replace(/:(\w+)(\([^)]*\))?/g, (_, name: string, group?: string) => {
        names.push(name)
        return group ?? '([^/]+)'
      })
      const match = new RegExp(`^${pattern}$`).exec(path)
      if (match) return names.reduce((to, name, index) => to.replace(`:${name}`, match[index + 1]), destination)
    }
    return undefined
  }

  it('sends links printed or shown by the old site to their Expo equivalents', () => {
    // The Vite projector QR pointed at the explanations page; the reader now carries explanations.
    expect(follow('/sessions/4006/explanations')).toBe('/sessions/4006/parts')
    expect(follow('/login')).toBe('/sign-in')
    expect(follow('/dashboard')).toBe('/')
    // Vite already could not load these: the link carries no service.
    expect(follow('/part/2066')).toBe('/')
  })

  it('never redirects current Expo routes', () => {
    for (const path of ['/', '/sign-in', '/sessions/4006/parts', '/sessions/4006/part/2066', '/sessions/4006/display', '/sessions/display', '/sessions/status/display', '/sessions/abc/explanations']) {
      expect(follow(path)).toBeUndefined()
    }
  })

  it('stays temporary so a rollback to the Vite deployment is not fought by cached redirects', () => {
    expect(redirects.every(redirect => redirect.permanent === false)).toBe(true)
  })
})
