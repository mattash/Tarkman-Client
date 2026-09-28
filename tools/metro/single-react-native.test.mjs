import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const { guardReactNative } = createRequire(import.meta.url)('./single-react-native.js')

function layout(name) {
  const root = mkdtempSync(join(tmpdir(), 'rn-guard-'))
  for (const dir of ['apps/app/node_modules/react-native/node_modules/react-native', 'apps/app/node_modules/react', 'node_modules/react', 'packages/shared']) mkdirSync(join(root, dir), { recursive: true })
  writeFileSync(join(root, 'apps/app/node_modules/react-native/package.json'), JSON.stringify({ name }))
  for (const file of ['apps/app/node_modules/react/index.js', 'node_modules/react/index.js', 'packages/shared/index.js', 'apps/app/node_modules/react-native/node_modules/react-native/index.js']) writeFileSync(join(root, file), '')
  return root
}
const context = { originModulePath: '/packages/shared/index.js' }

test('refuses an app whose react-native is not the declared fork', () => {
  const root = layout('react-native')
  assert.throws(() => guardReactNative(join(root, 'apps/app'), 'react-native-tvos', () => {}), /expected react-native-tvos/)
})

test("allows the app's own react and rejects any other copy, from any importer", () => {
  const root = layout('react-native-tvos')
  let target = join(root, 'apps/app/node_modules/react/index.js')
  const resolve = guardReactNative(join(root, 'apps/app'), 'react-native-tvos', () => ({ type: 'sourceFile', filePath: target }))
  assert.equal(resolve(context, 'react', 'ios').filePath, target)
  target = join(root, 'node_modules/react/index.js')
  assert.throws(() => resolve(context, 'react', 'ios'), /must bundle its own react/)
  // A peer the fork does not satisfy makes npm nest upstream react-native inside it (react-native-tvos#virtualized-lists).
  target = join(root, 'apps/app/node_modules/react-native/node_modules/react-native/index.js')
  assert.throws(() => resolve(context, 'react-native', 'ios'), /must bundle its own react-native/)
  target = join(root, 'packages/shared/index.js')
  assert.equal(resolve(context, './shared', 'ios').filePath, target)
})

test('resolves bare imports from shared packages as the app would', () => {
  const root = layout('react-native-tvos')
  const seen = []
  const resolve = guardReactNative(join(root, 'apps/app'), 'react-native-tvos', (context, name) => { seen.push([name, context.originModulePath]); return { type: 'sourceFile', filePath: join(root, 'apps/app/node_modules/react/index.js') } })
  resolve({ originModulePath: join(root, 'packages/shared/index.js') }, '@babel/runtime/helpers/x', 'ios')
  resolve({ originModulePath: join(root, 'packages/shared/index.js') }, './sibling', 'ios')
  resolve({ originModulePath: join(root, 'apps/app/index.js') }, 'lodash', 'ios')
  assert.deepEqual(seen.map(([, origin]) => origin), [join(root, 'apps/app/package.json'), join(root, 'packages/shared/index.js'), join(root, 'apps/app/index.js')])
})
