import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { classify, fingerprint, isNativeInput } from './native-inputs.mjs'

test('classifies shared and platform-specific native inputs', () => {
  for (const path of [
    '.github/workflows/node.js.yml',
    'apps/mobile/scripts/native-inputs.mjs',
    'apps/mobile/app.json',
    'apps/mobile/app.config.ts',
    'apps/mobile/package-lock.json',
    'apps/mobile/plugins/with-thing.js',
    'apps/mobile/assets/icons/app-icon.png',
  ]) {
    assert.equal(isNativeInput(path, 'ios'), true, path)
    assert.equal(isNativeInput(path, 'android'), true, path)
  }
  assert.equal(isNativeInput('apps/mobile/ios/Podfile', 'ios'), true)
  assert.equal(isNativeInput('apps/mobile/ios/Podfile', 'android'), false)
  assert.equal(isNativeInput('apps/mobile/android/build.gradle', 'android'), true)
  assert.equal(isNativeInput('apps/mobile/scripts/check-store-config.mjs', 'android'), true)
  assert.equal(isNativeInput('apps/mobile/scripts/check-store-config.mjs', 'ios'), false)
  for (const path of ['apps/mobile/app/index.tsx', 'apps/mobile/assets/fonts/x.ttf', 'packages/tarkman-core/src/index.ts', 'apps/mobile/app.jsonx']) {
    assert.equal(isNativeInput(path, 'ios'), false, path)
  }
  assert.throws(() => isNativeInput('apps/mobile/app.json', 'web'), /Unknown platform/)
})

test('fingerprints content, not order, and refuses an empty input set', () => {
  const a = '100644 blob aaa\tapps/mobile/package.json'
  const b = '100644 blob bbb\tapps/mobile/app.json'
  const js = '100644 blob ccc\tapps/mobile/app/index.tsx'
  assert.equal(fingerprint(`${a}\n${b}\n`, 'ios'), fingerprint(`${b}\n${js}\n${a}\n`, 'ios'))
  assert.notEqual(fingerprint(`${a}\n${b}`, 'ios'), fingerprint(`${a}\n100644 blob bbc\tapps/mobile/app.json`, 'ios'))
  assert.notEqual(fingerprint(`${a}\n${b}`, 'ios'), fingerprint(`${a}\n${b}`, 'android'))
  assert.notEqual(fingerprint(`${a}\n${b}`, 'ios', '2026-W40'), fingerprint(`${a}\n${b}`, 'ios', '2026-W41'))
  assert.throws(() => fingerprint(js, 'ios'), /No ios native inputs/)
})

// Representative PR scenarios against a real repository and merge commits.
test('reuses a compile only while the merged native inputs are unchanged', t => {
  const repo = mkdtempSync(join(tmpdir(), 'native-inputs-'))
  t.after(() => rmSync(repo, { recursive: true, force: true }))
  const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
  const write = (path, content) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true })
    writeFileSync(join(repo, path), content)
  }
  const commit = message => {
    git(['add', '-A'])
    git(['-c', 'user.name=CI', '-c', 'user.email=ci@example.invalid', 'commit', '-q', '-m', message])
    return git(['rev-parse', 'HEAD']).trim()
  }
  const merge = (base, head) => {
    git(['checkout', '-q', '--detach', base])
    git(['-c', 'user.name=CI', '-c', 'user.email=ci@example.invalid', 'merge', '-q', '--no-ff', '-m', 'merge', head])
    return git(['rev-parse', 'HEAD']).trim()
  }
  const run = (platform, base, head) => classify({ platform, base, head, tree: merge(base, head), git })

  git(['init', '-q', '-b', 'main'])
  write('.github/workflows/node.js.yml', 'on: pull_request\n')
  write('apps/mobile/package.json', '{"dependencies":{}}\n')
  write('apps/mobile/package-lock.json', '{}\n')
  write('apps/mobile/app.json', '{}\n')
  write('apps/mobile/app/index.tsx', 'export {}\n')
  write('README.md', 'docs\n')
  const main = commit('base')

  // A docs-only PR is not mobile-relevant.
  git(['checkout', '-q', '-b', 'docs', main])
  write('README.md', 'more docs\n')
  const docs = run('ios', main, commit('docs'))
  assert.equal(docs.mobile, false)
  assert.equal(docs.native, false)

  // The first native commit needs a compile under a new fingerprint.
  git(['checkout', '-q', '-b', 'feature', main])
  write('apps/mobile/package.json', '{"dependencies":{"react-native-svg":"15"}}\n')
  write('apps/mobile/package-lock.json', '{"svg":true}\n')
  const nativeHead = commit('add react-native-svg')
  const first = run('ios', main, nativeHead)
  assert.equal(first.mobile, true)
  assert.equal(first.native, true)
  assert.notEqual(first.fingerprint, run('ios', main, main).fingerprint)

  // A JavaScript-only follow-up is still a native PR, but matches the compiled inputs.
  git(['checkout', '-q', 'feature'])
  write('apps/mobile/app/index.tsx', 'export const x = 1\n')
  const jsHead = commit('js only')
  const followUp = run('ios', main, jsHead)
  assert.equal(followUp.native, true)
  assert.equal(followUp.fingerprint, first.fingerprint)
  assert.equal(run('android', main, jsHead).fingerprint, run('android', main, nativeHead).fingerprint)

  // A base update that only changes JavaScript or docs keeps the fingerprint.
  git(['checkout', '-q', 'main'])
  write('README.md', 'main docs\n')
  const mainJs = commit('main docs')
  assert.equal(run('ios', mainJs, jsHead).fingerprint, first.fingerprint)

  // A base update to native inputs or the workflow forces a new compile.
  git(['checkout', '-q', 'main'])
  write('.github/workflows/node.js.yml', 'on: pull_request # new runner\n')
  const mainNative = commit('toolchain change')
  assert.notEqual(run('ios', mainNative, jsHead).fingerprint, first.fingerprint)

  // A later native commit on the PR forces a new compile, and platforms stay independent.
  git(['checkout', '-q', 'feature'])
  write('apps/mobile/android/gradle.properties', 'x=1\n')
  const androidHead = commit('android native change')
  assert.equal(run('ios', main, androidHead).fingerprint, first.fingerprint)
  assert.notEqual(run('android', main, androidHead).fingerprint, run('android', main, jsHead).fingerprint)
  write('apps/mobile/app.json', '{"expo":{"plugins":["expo-camera"]}}\n')
  assert.notEqual(run('ios', main, commit('config change')).fingerprint, first.fingerprint)
})
