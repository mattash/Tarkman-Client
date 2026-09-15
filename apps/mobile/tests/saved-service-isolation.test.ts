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
test('PR 3 confines saved hydration to the reader hook; controller and control paths cannot read storage', () => {
  const references = sources(join(root, 'features')).concat(sources(join(root, 'app')))
    .filter(path => !relative(root, path).startsWith('features/offline/'))
    .filter(path => /offline\/|savedService|SavedService|ReaderCache/.test(readFileSync(path, 'utf8')))
    .map(path => relative(root, path)).sort()
  expect(references).toEqual(['features/live/controller.ts', 'features/live/useReader.ts'])
  const controller = readFileSync(join(root, 'features/live/controller.ts'), 'utf8')
  expect(controller).toContain("import type { SavedServiceInput } from '../offline/savedService'")
  expect(controller).not.toMatch(/loadSavedService|readSavedService|cache\.(load|read|clear)/)
  const hook = readFileSync(join(root, 'features/live/useReader.ts'), 'utf8')
  expect(hook).toContain('id === null ? undefined : { save: saveSavedService }')
  expect(hook).not.toMatch(/loadSavedService|readSavedService/)
  expect(hook).toContain('const saved = useSavedService(id)')
  expect(hook).toContain('return { saved, state, retry: controller.retry, dispatch: controller.dispatch }')
})
