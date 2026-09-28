import { describe, expect, it } from '@jest/globals'
import { initialState, type LivePart, type LiveSession, type ReaderState } from '@tarkman/reader'
import { availableLanguages, readingParts, splitText } from '../src/blocks'
import { freshness } from '../src/freshness'
import { canGoBack, currentRoute, initialNavigation, navigate } from '../src/navigation'

const session = { id: 7, title: 'Divine Liturgy', church: 'St. John', status: 'active', message: null } as LiveSession
const ready: ReaderState = { ...initialState, loading: false, stale: false, connected: true, listed: true, session, following: true }
const part = (key: string, text: Partial<LivePart['text']>, id = 1): LivePart =>
  ({ id, key, liturgyId: 1, liturgyPartId: null, position: 1, role: 'priest', posture: null, text: { en: null, ru: null, grabar: null, translit: null, ...text } })

describe('freshness', () => {
  it('claims live only when connected, current, listed, active and error-free', () => {
    expect(freshness(ready, true).kind).toBe('live')
    expect(freshness({ ...initialState }, true).kind).toBe('connecting')
    expect(freshness({ ...ready, connected: false, stale: true }, true).kind).toBe('reconnecting')
    expect(freshness({ ...ready, stale: true }, true).kind).toBe('reconnecting')
    expect(freshness(ready, false).kind).toBe('offline')
    expect(freshness({ ...ready, error: 'Could not refresh' }, true)).toEqual({ kind: 'stale', message: 'Could not refresh' })
    expect(freshness({ ...ready, session: { ...session, status: 'paused', message: 'Back soon' } }, true)).toEqual({ kind: 'status', status: 'paused', message: 'Back soon' })
    expect(freshness({ ...ready, listed: false }, true).kind).toBe('ended')
    expect(freshness({ ...ready, deleted: true, error: 'gone' }, true)).toEqual({ kind: 'unavailable', message: 'gone' })
  })
})

describe('reading blocks', () => {
  it('splits long text into remote-sized blocks without losing words', () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} of a long reading.`).join(' ')
    const blocks = splitText(`${long}\n\nShort paragraph.`, 200)
    expect(blocks.length).toBeGreaterThan(5)
    expect(blocks.every(block => block.length <= 200)).toBe(true)
    expect(blocks.join(' ').replace(/\s+/g, ' ')).toBe(`${long} Short paragraph.`)
    expect(splitText('Ա'.repeat(900), 400).map(b => b.length)).toEqual([400, 400, 100])
  })
  it('keeps repeated part IDs distinct by occurrence key and marks missing languages', () => {
    const parts = readingParts([part('lp:1', { en: 'Lord have mercy' }, 5), part('lp:2', { grabar: 'Տէր ողորմեա' }, 5)], 'en')
    expect(parts.map(p => p.key)).toEqual(['lp:1', 'lp:2'])
    expect(parts[0].blocks[0].key).toBe('lp:1#0')
    expect(parts[1]).toMatchObject({ missing: true, blocks: [] })
  })
  it('renders legacy HTML as inert text', () => {
    expect(readingParts([part('lp:1', { en: '<p>Peace <b>to all</b></p><script>x()</script>' })], 'en')[0].blocks[0].text).toBe('Peace to all')
  })
  it('offers only languages with text', () => {
    expect(availableLanguages([part('a', { en: 'x' }), part('b', { grabar: 'y' })], ['en', 'ru', 'grabar', 'translit'])).toEqual(['en', 'grabar'])
    expect(availableLanguages([], ['en', 'ru'])).toEqual(['en'])
  })
})

describe('navigation', () => {
  it('goes back one screen, never past the service list, and remembers the last service', () => {
    const reading = navigate(initialNavigation, { type: 'push', route: { name: 'reader', id: 7 } })
    expect(currentRoute(reading)).toEqual({ name: 'reader', id: 7 })
    expect(canGoBack(reading)).toBe(true)
    const back = navigate(reading, { type: 'back' })
    expect(back).toEqual({ stack: [{ name: 'services' }], lastServiceId: 7 })
    expect(canGoBack(back)).toBe(false)
    expect(navigate(back, { type: 'back' })).toBe(back)
  })
})
