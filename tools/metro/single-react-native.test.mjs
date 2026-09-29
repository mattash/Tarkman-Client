import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
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

test('allows only the app-local Expo HMR alias and still rejects foreign runtimes', () => {
  for (const name of ['react-native', 'react-native-tvos']) {
    const root = layout(name)
    const app = join(root, 'apps/app')
    const hmr = 'react-native/Libraries/Utilities/HMRClient'
    const alias = join(app, 'node_modules/expo/src/async-require/hmr.ts')
    mkdirSync(join(app, 'node_modules/expo/src/async-require'), { recursive: true })
    writeFileSync(alias, '')
    let target = alias
    const resolve = guardReactNative(app, name, () => ({ type: 'sourceFile', filePath: target }))
    const importer = { originModulePath: join(app, 'node_modules/@expo/metro-runtime/src/metroServerLogs.native.ts') }
    for (const platform of ['android', 'ios']) {
      for (const request of [hmr, `${hmr}.js`]) {
        assert.equal(resolve(importer, request, platform).filePath, alias)
      }
      for (const request of ['react', 'react/jsx-runtime', 'react-native', 'react-native/Libraries/Utilities/Platform', 'react-dom', 'scheduler']) {
        assert.throws(() => resolve(importer, request, platform), /must bundle its own/)
      }
      for (const file of [
        'node_modules/expo/src/async-require/hmr.ts',
        'apps/other/node_modules/expo/src/async-require/hmr.ts',
        'apps/app/node_modules/expo/src/async-require/other.ts',
        'node_modules/react-native/Libraries/Utilities/HMRClient.js',
        'apps/app/node_modules/react-native/node_modules/react-native/Libraries/Utilities/HMRClient.js',
        'node_modules/scheduler/index.js',
      ]) {
        target = join(root, file)
        mkdirSync(join(target, '..'), { recursive: true })
        writeFileSync(target, '')
        assert.throws(() => resolve(importer, file.includes('scheduler') ? 'scheduler' : hmr, platform), /must bundle its own/)
      }
      target = alias
    }
    // Comparing canonical destinations must not allow an app-local symlink to a foreign Expo.
    const linkedApp = join(root, 'apps/linked')
    mkdirSync(join(linkedApp, 'node_modules/react-native'), { recursive: true })
    writeFileSync(join(linkedApp, 'node_modules/react-native/package.json'), JSON.stringify({ name }))
    symlinkSync(join(app, 'node_modules/expo'), join(linkedApp, 'node_modules/expo'), 'dir')
    const linkedResolve = guardReactNative(linkedApp, name, () => ({ type: 'sourceFile', filePath: join(linkedApp, 'node_modules/expo/src/async-require/hmr.ts') }))
    assert.throws(() => linkedResolve(importer, hmr, 'ios'), /must bundle its own react-native/)
  }
})
