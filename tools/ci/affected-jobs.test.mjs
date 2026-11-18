import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempDisposableSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { changedPaths, planRevision, proposeGroups } from './affected-jobs.mjs'

const all = ['mobile', 'tv', 'design', 'legacy-web']
const regular = path => ({ path, before: '100644', after: '100644', status: 'M' })
const selected = ({ groups }) => Object.keys(groups).filter(group => groups[group].selected)
const plan = (...paths) => selected(proposeGroups(paths.map(regular), 'Ordinary PR'))

test('proposes omissions for audited standalone app source and includes mixed scope', () => {
  assert.deepEqual(plan('apps/mobile/app/index.tsx'), ['mobile', 'design'])
  assert.deepEqual(plan('apps/tv/src/App.tsx'), ['tv', 'design'])
  assert.deepEqual(plan('apps/web/app/styles.css'), ['design', 'legacy-web'])
  assert.deepEqual(plan('apps/mobile/app/index.tsx', 'apps/tv/src/App.tsx'), ['mobile', 'tv', 'design'])
})

test('selects every shared package consumer and cross-app contract', () => {
  assert.deepEqual(plan('packages/tarkman-core/src/index.ts'), all)
  assert.deepEqual(plan('packages/tarkman-reader/src/index.ts'), ['mobile', 'tv', 'design'])
  assert.deepEqual(plan('packages/tarkman-design/tokens.json'), ['mobile', 'tv', 'design'])
  assert.deepEqual(plan('packages/tarkman-lectionary/data/manifest.json'), ['mobile', 'design'])
  for (const path of ['assets/fonts/font.ttf', 'app.json', 'eas.json']) {
    assert.deepEqual(plan(`apps/mobile/${path}`), ['mobile', 'tv', 'design'])
  }
  for (const path of ['package.json', 'package-lock.json', 'tsconfig.json']) {
    assert.deepEqual(plan(`apps/mobile/${path}`), all)
  }
})

test('widens tooling, unknown scopes, unusual modes, missing context and overrides', () => {
  for (const path of ['tools/metro/foo.js', '.github/workflows/node.js.yml', 'package.json',
    'packages/new-package/foo.js', 'apps/mobile/scripts/native-inputs.mjs', 'apps/tv/app.json', 'apps/new.txt']) {
    assert.deepEqual(plan(path), all)
  }
  const tvFile = regular('apps/tv/src/App.tsx')
  for (const title of [undefined, '[FULL-ci] change', 'change [Native-Build]']) {
    assert.deepEqual(selected(proposeGroups([tvFile], title)), all)
  }
  assert.deepEqual(selected(proposeGroups([], 'Ordinary PR')), all)
  assert.deepEqual(selected(proposeGroups([{ ...tvFile, after: '120000' }], 'Ordinary PR')), all)
})

test('rejects malformed, truncated and non-UTF-8 diff records', () => {
  assert.throws(() => changedPaths(Buffer.from(':100644 000000 a 0 D\0apps/tv/src/gone.ts')), /Incomplete/)
  assert.throws(() => changedPaths(Buffer.from('garbage\0path\0')), /Unexpected/)
  assert.throws(() => changedPaths(Buffer.from([0xff, 0])), TypeError)
})

test('reads a real PR merge with a cross-app move, deletion and unusual filename', t => {
  const repo = mkdtempDisposableSync(join(tmpdir(), 'affected-jobs-'))
  t.after(() => repo.remove())
  const cwd = repo.path
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const put = (file, content) => {
    mkdirSync(dirname(join(cwd, file)), { recursive: true })
    writeFileSync(join(cwd, file), content)
  }
  const commit = () => {
    git('add', '--all')
    git('commit', '-qm', 'Fixture')
    return git('rev-parse', 'HEAD')
  }
  git('init', '-q', '-b', 'main')
  git('config', 'user.name', 'CI test')
  git('config', 'user.email', 'test@example.invalid')
  git('config', 'commit.gpgsign', 'false')
  put('apps/mobile/app/moved.ts', 'move me')
  put('apps/tv/src/removed.ts', 'remove me')
  const mergeBase = commit()
  git('switch', '-qc', 'topic')
  git('mv', 'apps/mobile/app/moved.ts', 'apps/tv/src/moved.ts')
  git('rm', 'apps/tv/src/removed.ts')
  put('apps/tv/src/odd\nname.ts', 'keep the whole filename')
  const head = commit()
  git('switch', '-q', 'main')
  put('unrelated-base-file.txt', 'not a PR change')
  const base = commit()
  git('merge', '-q', '--no-ff', 'topic', '-m', 'Merge')
  const revision = git('rev-parse', 'HEAD')
  const result = planRevision({ base, head, revision, cwd, title: 'Move' })
  assert.equal(result.mergeBase, mergeBase)
  assert.equal(result.revision, revision)
  assert.deepEqual(result.paths.map(({ path, status }) => [path, status]), [
    ['apps/mobile/app/moved.ts', 'D'], ['apps/tv/src/moved.ts', 'A'],
    ['apps/tv/src/odd\nname.ts', 'A'], ['apps/tv/src/removed.ts', 'D'],
  ])
  assert.deepEqual(selected(result), ['mobile', 'tv', 'design'])
  assert.throws(() => planRevision({ base: mergeBase, head, revision, cwd }), /expected PR merge/)
  assert.throws(() => planRevision({ base, head, revision: head, cwd }), /expected PR merge/)
})
