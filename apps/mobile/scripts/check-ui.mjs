import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'))
const forbidden = /^(?:@radix-ui\/|@tamagui\/|tamagui$|vaul(?:$|-)|nativewind\/v5|react-native-css$|react-markdown$|react-native-markdown|@tailwindcss\/)/
for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) assert(!forbidden.test(name), `Unsupported UI dependency: ${name}`)
assert.equal(lock.packages['node_modules/nativewind'].version.split('.')[0], '4')
assert.equal(lock.packages['node_modules/tailwindcss'].version.split('.')[0], '3')
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) { scan(path); continue }
    if (!/\.tsx?$/.test(path)) continue
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
    function visit(node) {
      if (ts.isStringLiteral(node) && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent) || ts.isCallExpression(node.parent))) {
        assert(!forbidden.test(node.text) && !node.text.includes('apps/web'), `Unsupported UI import in ${path}: ${node.text}`)
      }
      if (ts.isJsxAttribute(node) && node.name.getText(source) === 'allowFontScaling') assert(!node.initializer || node.initializer.getText(source) !== '{false}', `Text scaling disabled: ${path}`)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
}
for (const dir of ['app', 'components', 'design', 'features']) scan(resolve(root, dir))
console.log('Mobile UI guard passed: NativeWind 4 / Tailwind 3, no unsupported UI imports or disabled text scaling.')
