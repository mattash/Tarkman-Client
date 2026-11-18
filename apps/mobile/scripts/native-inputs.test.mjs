import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { classify, fingerprint, fingerprintTree, isNativeInput, isVersionOnlyChange, nativeBuildRequested } from './native-inputs.mjs'

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
  for (const platform of ['ios', 'android']) {
    for (const path of ['apps/mobile/eas.json', 'apps/mobile/.easignore', 'apps/mobile/scripts/check-store-config.mjs']) {
      assert.equal(isNativeInput(path, platform), false, path)
    }
  }
  for (const path of ['apps/mobile/app/index.tsx', 'apps/mobile/assets/fonts/x.ttf', 'packages/tarkman-core/src/index.ts', 'apps/mobile/app.jsonx']) {
    assert.equal(isNativeInput(path, 'ios'), false, path)
  }
  assert.throws(() => isNativeInput('apps/mobile/app.json', 'web'), /Unknown platform/)
})

test('classifies apps/tv native inputs for tvOS only', () => {
  for (const path of ['.github/workflows/node.js.yml', 'apps/mobile/scripts/native-inputs.mjs']) {
    assert.equal(isNativeInput(path, 'tvos'), true, path)
  }
  for (const path of [
    'apps/tv/app.json',
    'apps/tv/app.config.ts',
    'apps/tv/package.json',
    'apps/tv/package-lock.json',
    'apps/tv/plugins/with-thing.js',
    'apps/tv/assets/icons/topshelf-1920x720.png',
    'apps/tv/ios/Podfile',
  ]) {
    assert.equal(isNativeInput(path, 'tvos'), true, path)
    assert.equal(isNativeInput(path, 'ios'), false, path)
    assert.equal(isNativeInput(path, 'android'), false, path)
  }
  for (const path of [
    'apps/mobile/app.json',
    'apps/mobile/package-lock.json',
    'apps/mobile/ios/Podfile',
    'apps/tv/src/App.tsx',
    'apps/tv/assets/fonts/x.ttf',
    'apps/tv/eas.json',
    'packages/tarkman-reader/src/index.ts',
  ]) {
    assert.equal(isNativeInput(path, 'tvos'), false, path)
  }
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

  // tvOS reuse follows apps/tv only: mobile native and TV JavaScript edits keep it.
  const workflow = '100644 blob www\t.github/workflows/node.js.yml'
  const tv = '100644 blob ttt\tapps/tv/package-lock.json'
  const tvos = fingerprint(`${workflow}\n${tv}\n${a}\n${b}`, 'tvos')
  assert.equal(tvos, fingerprint(`${workflow}\n${tv}\n100644 blob ddd\tapps/mobile/package.json\n100644 blob eee\tapps/tv/src/App.tsx`, 'tvos'))
  assert.notEqual(tvos, fingerprint(`${workflow}\n100644 blob ttu\tapps/tv/package-lock.json`, 'tvos'))
  assert.notEqual(tvos, fingerprint(`100644 blob wwx\t.github/workflows/node.js.yml\n${tv}`, 'tvos'))
  assert.notEqual(tvos, fingerprint(`${workflow}\n${tv}\n100644 blob iii\tapps/tv/assets/icons/icon.png`, 'tvos'))
  assert.equal(fingerprint(`${workflow}\n${a}\n${b}`, 'ios'), fingerprint(`${workflow}\n${a}\n${b}\n${tv}`, 'ios'))
})

test('fingerprints tvOS from the command line without a change classification', () => {
  const root = new URL('../../../', import.meta.url).pathname
  const script = new URL('./native-inputs.mjs', import.meta.url).pathname
  const run = args => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' })
  const result = run(['--platform', 'tvos', '--tree', 'HEAD', '--salt', '2026-W47'])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /^fingerprint=[0-9a-f]{64}\n$/)
  assert.equal(result.stdout, `fingerprint=${fingerprintTree({ platform: 'tvos', salt: '2026-W47' })}\n`)
  assert.notEqual(run(['--platform', 'ios', '--tree', 'HEAD']).status, 0)
  assert.throws(() => classify({ platform: 'tvos', base: 'a', head: 'b', git: () => '' }), /No change classification/)
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
  const run = (platform, base, head, title = '') => classify({ platform, base, head, title, tree: merge(base, head), git })

  git(['init', '-q', '-b', 'main'])
  write('.github/workflows/node.js.yml', 'on: pull_request\n')
  write('apps/mobile/package.json', '{"version":"0.1.0","dependencies":{}}\n')
  write('apps/mobile/package-lock.json', '{}\n')
  write('apps/mobile/app.json', '{"expo":{"version":"0.1.1"}}\n')
  write('apps/mobile/eas.json', '{"build":{"production":{}},"submit":{}}\n')
  write('apps/mobile/.easignore', 'node_modules/\n')
  write('apps/mobile/scripts/check-store-config.mjs', '// store assertions\n')
  write('apps/mobile/app/index.tsx', 'export {}\n')
  write('README.md', 'docs\n')
  const main = commit('base')

  // A docs-only PR is not mobile-relevant.
  git(['checkout', '-q', '-b', 'docs', main])
  write('README.md', 'more docs\n')
  const docs = run('ios', main, commit('docs'))
  assert.equal(docs.mobile, false)
  assert.equal(docs.native, false)

  // Generated lectionary data must run both bundle smoke checks without a native compile.
  git(['checkout', '-q', '-b', 'lectionary', main])
  write('packages/tarkman-lectionary/data/2026-en.json', '{"schemaVersion":1}\n')
  const lectionaryHead = commit('update bundled lectionary')
  for (const platform of ['ios', 'android']) {
    const result = run(platform, main, lectionaryHead)
    assert.equal(result.mobile, true)
    assert.equal(result.native, false)
    assert.equal(result.requested, false)
    assert.equal(result.fingerprint, run(platform, main, main).fingerprint)
  }

  // PR #217: valid version-only edits are informational, not native changes.
  git(['checkout', '-q', '-b', 'version', main])
  write('apps/mobile/app.json', '{"expo":{"version":"0.2.0"}}\n')
  write('apps/mobile/package.json', '{"version":"0.2.0","dependencies":{}}\n')
  const versionHead = commit('bump versions')
  for (const platform of ['ios', 'android']) {
    const result = run(platform, main, versionHead)
    assert.equal(result.mobile, true)
    assert.equal(result.native, false)
    assert.equal(result.requested, false)
    // Explicit builds must still fingerprint the actual shipped metadata.
    assert.notEqual(result.fingerprint, run(platform, main, main).fingerprint)
    assert.equal(run(platform, main, versionHead, '[NATIVE-BUILD] Release').requested, true)
    assert.equal(run(platform, main, versionHead, 'native-build Release').requested, false)
    const forced = run(platform, main, main, 'Docs [native-build]')
    assert.equal(forced.mobile, true)
    assert.equal(forced.requested, true)
  }

  // PR #207: production AAB packaging, internal draft submission, assertions and docs.
  git(['checkout', '-q', '-b', 'store', main])
  write('apps/mobile/eas.json', JSON.stringify({
    build: { production: { android: { buildType: 'app-bundle' } } },
    submit: { 'android-internal': { android: { track: 'internal', releaseStatus: 'draft' } } },
  }))
  write('apps/mobile/scripts/check-store-config.mjs', 'assert.equal(buildType, "app-bundle")\n')
  write('apps/mobile/docs/android-release.md', 'Internal draft submission\n')
  const storeHead = commit('store packaging and validation')
  for (const platform of ['ios', 'android']) {
    const result = run(platform, main, storeHead)
    assert.equal(result.mobile, true)
    assert.equal(result.native, false)
    assert.equal(result.fingerprint, run(platform, main, main).fingerprint)
  }
  git(['checkout', '-q', 'store'])
  write('apps/mobile/.easignore', 'qa/\n')
  const archiveHead = commit('EAS upload exclusions')
  for (const platform of ['ios', 'android']) {
    assert.equal(run(platform, main, archiveHead).native, false)
    assert.equal(run(platform, main, archiveHead).fingerprint, run(platform, main, main).fingerprint)
  }

  // The first native commit needs a compile under a new fingerprint.
  git(['checkout', '-q', '-b', 'feature', main])
  write('apps/mobile/package.json', '{"dependencies":{"react-native-svg":"15"}}\n')
  write('apps/mobile/package-lock.json', '{"svg":true}\n')
  const nativeHead = commit('add react-native-svg')
  const first = run('ios', main, nativeHead)
  assert.equal(first.mobile, true)
  assert.equal(first.native, true)
  assert.equal(first.requested, false)
  assert.equal(run('ios', main, nativeHead, '[native-build]').requested, true)
  assert.notEqual(first.fingerprint, run('ios', main, main).fingerprint)

  // A JavaScript-only follow-up is still a native PR, but matches the compiled inputs.
  git(['checkout', '-q', 'feature'])
  write('apps/mobile/app/index.tsx', 'export const x = 1\n')
  const jsHead = commit('js only')
  const followUp = run('ios', main, jsHead)
  assert.equal(followUp.native, true)
  assert.equal(followUp.fingerprint, first.fingerprint)
  assert.equal(run('android', main, jsHead).fingerprint, run('android', main, nativeHead).fingerprint)

  // Store-only follow-ups also reuse a native PR's already verified inputs.
  git(['checkout', '-q', 'feature'])
  write('apps/mobile/eas.json', '{"submit":{"android-internal":{"android":{"releaseStatus":"draft"}}}}\n')
  write('apps/mobile/scripts/check-store-config.mjs', '// additional store assertions\n')
  const storeFollowUp = commit('store-only follow-up')
  for (const platform of ['ios', 'android']) {
    assert.equal(run(platform, main, storeFollowUp).native, true)
    assert.equal(run(platform, main, storeFollowUp).fingerprint, run(platform, main, nativeHead).fingerprint)
  }

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

// This exclusion is safe only while config validation remains unconditional and
// required through the aggregate `mobile` check.
test('mobile CI validates store settings even when both native compiles are skipped', () => {
  const workflow = readFileSync(new URL('../../../.github/workflows/node.js.yml', import.meta.url), 'utf8')
  const job = name => workflow.split(`\n  ${name}:\n`)[1].split(/\n {2}[a-z][a-z-]+:\n/)[0]
  const gate = job('mobile')
  const needs = gate.match(/^ {4}needs: \[([^\]]+)\]$/m)[1].split(',').map(name => name.trim())
  assert.deepEqual(needs, ['mobile-checks', 'mobile-test', 'mobile-export'])
  assert.match(gate, /^ {4}if: always\(\)$/m)
  for (const name of needs) {
    const [header, ...steps] = job(name).split(/^ {4}- /m)
    assert.doesNotMatch(header, /^ {4}if:/m, name)
    for (const step of steps) {
      // Cache IO may be conditional, but the suite and other validation may not.
      if (name === 'mobile-test' && /\n {6}uses: actions\/cache\/(restore|save)@v5\n/.test(step)) continue
      assert.doesNotMatch(step, /^ {6}if:/m, name)
    }
  }
  for (const command of ['npm run check:store-config', 'npm run config', 'npx expo prebuild --platform ios --clean --no-install', 'npm test', 'npm run lint', 'npm run typecheck', 'npm run export:web']) {
    assert.ok(needs.some(name => job(name).includes(command)), command)
  }

  // The aggregate passes only when every mobile job succeeded.
  const body = gate.split('      run: |\n')[1].split('\n').map(line => line.slice(8)).join('\n')
  const verify = results => spawnSync('bash', ['-e', '-c', body], { env: { ...process.env, RESULTS: JSON.stringify(results) }, encoding: 'utf8' })
  const all = result => Object.fromEntries(needs.map(name => [name, { result, outputs: {} }]))
  const check = verify(all('success'))
  assert.equal(check.status, 0, check.stderr)
  for (const failure of ['failure', 'cancelled', 'skipped']) {
    assert.notEqual(verify({ ...all('success'), 'mobile-test': { result: failure, outputs: {} } }).status, 0, failure)
  }
  assert.notEqual(verify({}).status, 0)
})


test('version exception fails closed for invalid versions and other native edits', () => {
  const app = value => JSON.stringify({ expo: value })
  const before = app({ version: '0.1.1', plugins: ['expo-camera'] })
  assert.equal(isVersionOnlyChange('apps/mobile/app.json', before, app({ plugins: ['expo-camera'], version: '0.2.0' })), true)
  for (const after of ['{', '{}', app({ version: 'banana', plugins: ['expo-camera'] }), app({ version: '0.2.0', plugins: [] }), app({ version: '0.2.0', ios: { buildNumber: '2' }, plugins: ['expo-camera'] })]) {
    assert.equal(isVersionOnlyChange('apps/mobile/app.json', before, after), false)
  }
  assert.equal(isVersionOnlyChange('apps/mobile/package.json', '{"version":"0.1.0","dependencies":{}}', '{"version":"0.2.0","dependencies":{"expo":"58"}}'), false)
  assert.equal(isVersionOnlyChange('apps/mobile/package-lock.json', '{"version":"0.1.0"}', '{"version":"0.2.0"}'), false)
})

// Execute the actual workflow shell bodies so opt-out and failure handling cannot
// silently diverge between the classifier, reuse decision and required gates.
test('title opt-in controls both compile decisions and aggregate gates', t => {
  const workflow = readFileSync(new URL('../../../.github/workflows/node.js.yml', import.meta.url), 'utf8')
  // Title and description edits must not re-run CI on an already tested commit.
  assert.match(workflow, /\n {2}pull_request:\n {4}types: \[opened, synchronize, reopened\]\n/)
  const dir = mkdtempSync(join(tmpdir(), 'native-policy-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const runBlock = (job, step) => {
    const jobText = workflow.split(`\n  ${job}:\n`)[1].split(/\n {2}[a-z][a-z-]+:\n/)[0]
    const body = jobText.split(`    - name: ${step}\n`)[1].split('      run: |\n')[1]
    return body.split(/\n(?= {0,6}\S)/)[0].split('\n').map(line => line.slice(8)).join('\n')
  }
  const decisionJobs = { ios: 'ios-changes', android: 'android-changes', tvos: 'tv' }
  for (const platform of ['ios', 'android', 'tvos']) {
    const label = { ios: 'iOS', android: 'Android', tvos: 'tvOS' }[platform]
    const decision = runBlock(decisionJobs[platform], 'Decide whether to compile')
    const output = join(dir, `${platform}-output`)
    const marker = join(dir, `${platform}.json`)
    const decide = (requested, data, cacheHit = 'true') => {
      writeFileSync(output, '')
      writeFileSync(marker, JSON.stringify(data))
      const result = spawnSync('bash', ['-e', '-c', decision], { env: { ...process.env, BUILD_REQUESTED: requested, FINGERPRINT: 'fp', CACHE_HIT: cacheHit, MARKER: marker, GITHUB_OUTPUT: output }, encoding: 'utf8' })
      assert.equal(result.status, 0, result.stderr)
      return readFileSync(output, 'utf8')
    }
    const valid = { platform, result: 'success', fingerprint: 'fp', run_url: 'https://example.invalid/run', head_sha: 'abc' }
    assert.match(decide('false', {}), /compile=false/)
    assert.match(decide('true', {}, 'false'), /compile=true/)
    assert.match(decide('true', valid), /compile=false/)
    assert.match(decide('true', { ...valid, fingerprint: 'different' }), /compile=true/)
    assert.match(decide('true', { ...valid, result: 'failure' }), /compile=true/)
    assert.match(decide('true', { ...valid, platform: 'other' }), /compile=true/)
    if (platform === 'tvos') continue
    const gate = runBlock(`${platform}-build`, `Verify ${label} compile outcome`)
    const check = overrides => spawnSync('bash', ['-e', '-c', gate], { env: { ...process.env, CHANGES_RESULT: 'success', MOBILE_CHANGED: 'true', BUILD_REQUESTED: 'false', COMPILE_NEEDED: 'false', REUSED_RUN: '', BUNDLE_RESULT: 'success', COMPILE_RESULT: 'skipped', ...overrides } }).status
    assert.equal(check({}), 0)
    assert.equal(check({ BUILD_REQUESTED: 'true', COMPILE_NEEDED: 'true', COMPILE_RESULT: 'success' }), 0)
    assert.equal(check({ BUILD_REQUESTED: 'true', REUSED_RUN: valid.run_url }), 0)
    assert.notEqual(check({ BUILD_REQUESTED: 'true' }), 0)
    for (const failure of ['failure', 'cancelled', 'skipped']) {
      assert.notEqual(check({ BUILD_REQUESTED: 'true', COMPILE_NEEDED: 'true', COMPILE_RESULT: failure }), 0)
      assert.notEqual(check({ BUNDLE_RESULT: failure }), 0)
    }
    assert.notEqual(check({ CHANGES_RESULT: 'failure' }), 0)
  }
  // apps/tv: the same tag requests tv-compile, and the stable tv-build gate enforces the outcome.
  assert.equal(nativeBuildRequested('[Native-Build] tvOS'), true)
  assert.equal(nativeBuildRequested('native-build tvOS'), false)
  assert.equal(nativeBuildRequested(undefined), false)
  assert.match(workflow, /\n {2}tv-compile:\n {4}needs: tv\n {4}if: needs\.tv\.outputs\.compile == 'true'\n/)
  const request = runBlock('tv', 'Read the native build request')
  const requestOutput = join(dir, 'tv-request')
  const ask = title => {
    writeFileSync(requestOutput, '')
    const cwd = new URL('../../../', import.meta.url).pathname
    const result = spawnSync('bash', ['-e', '-c', request], { cwd, env: { ...process.env, PR_TITLE: title, GITHUB_OUTPUT: requestOutput }, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    return readFileSync(requestOutput, 'utf8')
  }
  assert.match(ask('[native-build] tvOS'), /^requested=true$/m)
  assert.match(ask('tvOS'), /^requested=false$/m)
  assert.match(ask(''), /^requested=false$/m)
  const tvGate = runBlock('tv-build', 'Verify tvOS compile outcome')
  const tvCheck = overrides => spawnSync('bash', ['-e', '-c', tvGate], { env: { ...process.env, TV_RESULT: 'success', BUILD_REQUESTED: 'false', COMPILE_NEEDED: 'false', REUSED_RUN: '', COMPILE_RESULT: 'skipped', ...overrides } }).status
  assert.equal(tvCheck({}), 0)
  assert.equal(tvCheck({ BUILD_REQUESTED: 'true', COMPILE_NEEDED: 'true', COMPILE_RESULT: 'success' }), 0)
  assert.equal(tvCheck({ BUILD_REQUESTED: 'true', REUSED_RUN: 'https://example.invalid/run' }), 0)
  assert.notEqual(tvCheck({ BUILD_REQUESTED: 'true' }), 0)
  for (const failure of ['failure', 'cancelled', 'skipped']) assert.notEqual(tvCheck({ BUILD_REQUESTED: 'true', COMPILE_NEEDED: 'true', COMPILE_RESULT: failure }), 0)
  assert.notEqual(tvCheck({ COMPILE_RESULT: 'success' }), 0)
  assert.notEqual(tvCheck({ TV_RESULT: 'failure' }), 0)

  // Every title consumer reads the live title, falling back to the event's on an API failure.
  const titleSteps = ['ios-changes', 'android-changes', 'tv'].map(job => runBlock(job, 'Read the current PR title'))
  assert.equal(new Set(titleSteps).size, 1)
  const bin = join(dir, 'bin')
  mkdirSync(bin)
  writeFileSync(join(bin, 'gh'), '#!/bin/sh\n[ -n "$FAKE_GH_TITLE" ] || exit 1\nprintf "%s\\n" "$FAKE_GH_TITLE"\n')
  chmodSync(join(bin, 'gh'), 0o755)
  const titleOutput = join(dir, 'title-output')
  const readTitle = env => {
    writeFileSync(titleOutput, '')
    const result = spawnSync('bash', ['-e', '-c', titleSteps[0]], { env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_REPOSITORY: 'owner/repo', GITHUB_OUTPUT: titleOutput, EVENT_TITLE: 'Old title', PR_NUMBER: '7', ...env }, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    return { output: readFileSync(titleOutput, 'utf8'), stdout: result.stdout }
  }
  assert.equal(readTitle({ FAKE_GH_TITLE: '[native-build] New title' }).output, 'title=[native-build] New title\n')
  const fallback = readTitle({ FAKE_GH_TITLE: '' })
  assert.equal(fallback.output, 'title=Old title\n')
  assert.match(fallback.stdout, /::warning::/)
  // Push runs have no PR: the title stays empty without an API call.
  assert.equal(readTitle({ EVENT_TITLE: '', PR_NUMBER: '', FAKE_GH_TITLE: 'unused' }).output, 'title=\n')
})
