import { describe, expect, it } from '@jest/globals'
import { loadSavedDisplay, newSavedDisplay, resetSavedDisplay, saveDisplay, SAVED_DISPLAY_KEY, SavedDisplayStorageError, validateSavedDisplay } from '../src/savedDisplay'
import { memoryStore } from '../src/storage'

const record = newSavedDisplay({ id: 'c1', name: 'St. John', locality: 'Southfield' }, { id: 'l1', title: 'Sanctuary', token: 'tok1' }, 1_800_000_000_000)

describe('saved display', () => {
  it('round-trips, storing only public identity (no session id)', async () => {
    const store = memoryStore()
    await saveDisplay(store, record)
    expect(await loadSavedDisplay(store)).toEqual({ kind: 'saved', record })
    expect(Object.keys(JSON.parse(store.data.get(SAVED_DISPLAY_KEY)!)).sort()).toEqual(['church', 'link', 'savedAt', 'version'])
    expect(store.data.get(SAVED_DISPLAY_KEY)).not.toMatch(/session/i)
  })
  it('reports nothing saved, and re-projects away unknown fields', async () => {
    expect(await loadSavedDisplay(memoryStore())).toEqual({ kind: 'none' })
    const extra = { ...record, church: { ...record.church, email: 'x@y.z' }, link: { ...record.link, secret: 1 }, other: true }
    expect(validateSavedDisplay(extra)).toEqual(record)
  })
  it.each([
    ['not JSON', '{oops'], ['wrong shape', JSON.stringify({ version: 1 })], ['blank token', JSON.stringify({ ...record, link: { ...record.link, token: '   ' } })],
    ['token with space', JSON.stringify({ ...record, link: { ...record.link, token: 'a b' } })], ['old version', JSON.stringify({ ...record, version: 0 })],
  ])('treats %s as unreadable without deleting it', async (_name, raw) => {
    const store = memoryStore({ [SAVED_DISPLAY_KEY]: raw })
    expect(await loadSavedDisplay(store)).toEqual({ kind: 'unreadable', reason: 'corrupt' })
    expect(store.data.get(SAVED_DISPLAY_KEY)).toBe(raw)
  })
  it('distinguishes a record written by a newer app', async () => {
    const store = memoryStore({ [SAVED_DISPLAY_KEY]: JSON.stringify({ ...record, version: 2 }) })
    expect(await loadSavedDisplay(store)).toEqual({ kind: 'unreadable', reason: 'newer' })
  })
  it('treats a storage read failure as unreadable rather than as nothing saved', async () => {
    const store = { get: async () => { throw new Error('keychain locked') }, set: async () => {}, remove: async () => {} }
    expect(await loadSavedDisplay(store)).toEqual({ kind: 'unreadable', reason: 'corrupt' })
  })
  it('does not report a save it cannot read back, and leaves the old record alone', async () => {
    const store = memoryStore()
    await saveDisplay(store, record)
    const lossy = { ...store, set: async () => {} }
    await expect(saveDisplay(lossy, newSavedDisplay(record.church, { ...record.link, id: 'l2' }, 2))).rejects.toBeInstanceOf(SavedDisplayStorageError)
    expect((await loadSavedDisplay(store) as { record: { link: { id: string } } }).record.link.id).toBe('l1')
    await expect(saveDisplay({ ...store, set: async () => { throw new Error('denied') } }, record)).rejects.toBeInstanceOf(SavedDisplayStorageError)
  })
  it('resets, and reports a failed reset', async () => {
    const store = memoryStore()
    await saveDisplay(store, record)
    await resetSavedDisplay(store)
    expect(await loadSavedDisplay(store)).toEqual({ kind: 'none' })
    await expect(resetSavedDisplay({ ...store, remove: async () => { throw new Error('nope') } })).rejects.toBeInstanceOf(SavedDisplayStorageError)
  })
})
