import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { prepare, validateDestination, replaceOnce, BASE } from './prepare.mjs'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tarkman-siri-prepare-test-')))
const productionPaths = ['apps/mobile/package.json', 'apps/mobile/package-lock.json', 'apps/mobile/app/_layout.tsx', 'apps/mobile/app.json']

test('destination validation rejects relative, existing, repository and symlink paths', () => {
  assert.throws(() => validateDestination('relative'))
  assert.throws(() => validateDestination(temp))
  assert.throws(() => validateDestination(path.join(root, 'not-created')))
  fs.symlinkSync(temp, path.join(temp, 'link'))
  assert.throws(() => validateDestination(path.join(temp, 'link', 'new')))
  fs.symlinkSync(path.join(temp, 'missing'), path.join(temp, 'dangling'))
  assert.throws(() => validateDestination(path.join(temp, 'dangling')))
  assert.throws(() => replaceOnce('no anchor', 'anchor!', 'x'))
  assert.throws(() => replaceOnce('a a', 'a', 'x'))
})

test('pinned prototype and genuine baseline are isolated without touching production', () => {
  const before = productionPaths.map(file => fs.readFileSync(path.join(root, file)))
  for (const baseline of [false, true]) {
    const output = prepare({ destination: path.join(temp, baseline ? 'before' : 'after'), baseline, install: false })
    const mobile = path.join(output, 'apps/mobile')
    assert.ok(fs.existsSync(path.join(output, 'vercel.json')), 'universal-links fixture must be exported')
    assert.equal(typeof require(path.join(mobile, 'scripts/jest-resolver.js')), 'function', 'real shared Jest resolver must load from the prepared copy')
    assert.equal(typeof require(path.join(output, 'tools/metro/single-react-native.js')).guardReactNative, 'function', 'Metro guard must be exported')
    const configure = require(path.join(mobile, 'app.config.js'))
    const original = require(path.join(mobile, 'app.json')).expo
    const snapshot = structuredClone(original)
    // No environment flag needed: even absent/incorrect env cannot select production identity.
    const config = configure({ config: original })
    assert.deepEqual(original, snapshot)
    assert.equal(config.ios.bundleIdentifier, 'app.tarkman.sirispike')
    assert.equal(config.android.package, 'app.tarkman.sirispike')
    assert.equal(config.name, 'Tarkman Siri Spike')
    assert.equal(config.slug, 'tarkman-siri-spike')
    assert.equal(config.scheme, 'tarkman-siri-spike')
    assert.deepEqual(config.ios.associatedDomains, [])
    assert.deepEqual(config.android.intentFilters, [])
    assert.deepEqual(config.updates, { enabled: false })
    assert.equal(config.extra.eas, undefined)
    assert.equal(config.extra.siriSpike, !baseline)
    const layout = fs.readFileSync(path.join(mobile, 'app/_layout.tsx'), 'utf8')
    const pkg = require(path.join(mobile, 'package.json'))
    // Installation is deliberately disabled for tests; no npm/network/native build side effects.
    assert.equal(pkg.dependencies['expo-app-intents'], undefined)
    assert.equal(fs.existsSync(path.join(mobile, 'node_modules')), false)
    assert.equal(fs.existsSync(path.join(mobile, 'app-intents')), !baseline)
    assert.equal(fs.existsSync(path.join(mobile, 'features/siri')), !baseline)
    assert.equal(layout.includes('OpeningIntentHandler'), !baseline)
    if (baseline) {
      assert.equal(config.experiments?.inlineModules, undefined)
      assert.ok(!config.plugins.includes('expo-app-intents'))
    } else {
      assert.deepEqual(config.experiments.inlineModules.watchedDirectories, ['app-intents'])
      assert.equal(config.plugins.at(-1), 'expo-app-intents')
      assert.equal(layout.match(/<OpeningIntentHandler \/>/g)?.length, 1)
    }
    assert.equal(require(path.join(output, 'siri-spike-preparation.json')).base, BASE)
    assert.throws(() => prepare({ destination: output, baseline, install: false }))
  }
  productionPaths.forEach((file, index) => assert.deepEqual(fs.readFileSync(path.join(root, file)), before[index], file))
  const pkg = JSON.parse(before[0])
  assert.equal(pkg.dependencies['expo-app-intents'], undefined, 'normal manifest must not depend on bridge')
  assert.equal(pkg.dependencies['@expo/ui'], undefined, 'normal manifest must not depend on new native peer')
  const lock = JSON.parse(before[1])
  assert.equal(lock.packages['node_modules/expo-app-intents'], undefined, 'normal lock must not contain bridge')
  assert.equal(lock.packages['node_modules/expo-app-intents/node_modules/@expo/ui'], undefined, 'normal lock must not contain new native peer')
  assert.ok(!before[2].toString().includes('OpeningIntentHandler'), 'normal layout must not import bridge handler')
})
