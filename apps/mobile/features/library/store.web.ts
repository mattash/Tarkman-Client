import { LibraryError } from './contracts'
import type { LibraryRepository } from './repository'
/** Web is online only. Dismissal is a preference, never a downloaded bundle. */
export const libraryStore: LibraryRepository = {
  durable: false,
  async hydrate(environment) {
    let dismissed = false
    try { dismissed = typeof localStorage !== 'undefined' && localStorage.getItem(`library.dismissed:${environment}`) === '1' } catch { /* Optional preference. */ }
    return { items: [], dismissed, corrupt: 0 }
  },
  async intent() { throw new LibraryError('unsupported') },
  async commit() { throw new LibraryError('unsupported') },
  async verify() { throw new LibraryError('unsupported') },
  async remove() {},
  async dismiss(environment) { try { localStorage.setItem(`library.dismissed:${environment}`, '1') } catch { throw new LibraryError('storage') } },
}
