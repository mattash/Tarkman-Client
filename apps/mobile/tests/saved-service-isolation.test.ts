import { expect, test } from '@jest/globals'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = join(__dirname, '..')
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) ? [path] : []
  })
}
test('saved storage is only read by the reader hook and only cleared from Settings', () => {
  const references = sources(join(root, 'features')).concat(sources(join(root, 'app')))
    .filter(path => !relative(root, path).startsWith('features/offline/'))
    .filter(path => /offline\/|savedService|SavedService|ReaderCache/.test(readFileSync(path, 'utf8')))
    .map(path => relative(root, path)).sort()
  expect(references).toEqual(['features/home/Settings.tsx', 'features/live/controller.ts', 'features/live/useReader.ts'])
  const settings = readFileSync(join(root, 'features/home/Settings.tsx'), 'utf8')
  expect(settings).toContain("import { clearSavedService } from '../offline/savedServiceStore'")
  expect(settings).not.toMatch(/loadSavedService|readSavedService|useSavedService/)
  // Mobile's controller only binds the shared engine; the engine may write the cache but never read or clear it.
  const controller = readFileSync(join(root, 'features/live/controller.ts'), 'utf8')
  expect(controller).toContain("export type { Lifecycle, ReaderCache } from '@tarkman/reader'")
  expect(controller).not.toMatch(/loadSavedService|readSavedService|cache\.(load|read|clear)/)
  const engine = readFileSync(join(root, '../../packages/tarkman-reader/src/controller.ts'), 'utf8')
  expect(engine).toContain('save(input: ReaderSnapshotInput): void | Promise<void>')
  expect(engine).not.toMatch(/loadSavedService|readSavedService|cache\.(load|read|clear)|\bsaved\w*\(/i)
  const hook = readFileSync(join(root, 'features/live/useReader.ts'), 'utf8')
  expect(hook).toContain('id === null ? undefined : { save: saveSavedService }')
  expect(hook).not.toMatch(/loadSavedService|readSavedService/)
  expect(hook).toContain('const saved = useSavedService(id)')
  expect(hook).toContain('return { saved, state, retry: controller.retry, refreshAfterCommand: controller.refreshAfterCommand, dispatch: controller.dispatch }')
})
