// The TV display must read exactly like mobile's: its embedded reading fonts are byte-identical copies of
// apps/mobile/assets/fonts (which apps/mobile's check:fonts pins and verifies), with their licenses.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tv = join(dirname(fileURLToPath(import.meta.url)), '..')
const files = ['SourceSerif4-Regular.ttf', 'SourceSerif4-Semibold.ttf', 'NotoSerifArmenian-Regular.ttf', 'NotoSerifArmenian-Bold.ttf', 'OFL.txt', 'SourceSerif-LICENSE.md']
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const failures = files.filter(file => !existsSync(join(tv, 'assets/fonts', file)) || hash(join(tv, 'assets/fonts', file)) !== hash(join(tv, '../mobile/assets/fonts', file)))
const plugin = JSON.parse(readFileSync(join(tv, 'app.json'), 'utf8')).expo.plugins.find(p => Array.isArray(p) && p[0] === 'expo-font')
const embedded = new Set(plugin?.[1]?.fonts ?? [])
const missing = files.filter(file => file.endsWith('.ttf') && !embedded.has(`./assets/fonts/${file}`))
if (failures.length || missing.length) {
  console.error(`TV fonts differ from mobile: ${failures.join(', ') || 'none'}; not embedded: ${missing.join(', ') || 'none'}`)
  process.exit(1)
}
console.log('TV fonts OK: identical to apps/mobile and embedded')
