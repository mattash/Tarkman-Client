import type { Bundle } from './contracts'
export interface SavedItem { id: number; bundle: Bundle | null; savedAt: number | null; verifiedAt: number | null }
export interface Hydration { items: SavedItem[]; dismissed: boolean; corrupt: number }
export interface LibraryRepository {
  durable: boolean
  hydrate(environment: string): Promise<Hydration>
  intent(environment: string, id: number): Promise<void>
  commit(environment: string, bundle: Bundle, now: number, valid: () => boolean): Promise<void>
  verify(environment: string, id: number, now: number): Promise<void>
  remove(environment: string, id?: number): Promise<void>
  dismiss(environment: string): Promise<void>
}
