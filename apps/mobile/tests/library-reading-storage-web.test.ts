import { readingStorage } from '../features/library/readingStorage.web'
import { createReadingMetadataStore } from '../features/library/readingMetadata'

const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
afterEach(() => {
  if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
  else Reflect.deleteProperty(globalThis, 'localStorage')
})

test('web metadata reports blocked reads and deletion rather than silently claiming success', async () => {
  const failure = () => { throw new Error('storage unavailable') }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: failure, setItem: failure, removeItem: failure } })
  const metadata = createReadingMetadataStore(readingStorage)
  expect((await metadata.readResult({ environment: 'https://example.test', liturgyId: 1 })).status).toBe('storage')
  expect(await metadata.clearEnvironment('https://example.test')).toBe(false)
})

test('web metadata persists locally without any content download', async () => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  } })
  await readingStorage.set('metadata', 'anchor')
  expect(await readingStorage.get('metadata')).toBe('anchor')
  await readingStorage.remove('metadata')
  expect(await readingStorage.get('metadata')).toBeNull()
})
