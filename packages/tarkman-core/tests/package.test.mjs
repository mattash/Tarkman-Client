import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { checkDependencyFields, checkPackage } from '../scripts/check-package.mjs'

test('core and both app lockfiles cannot require an extra install through the local link', () => {
  checkPackage()
})

test('rejects the original TypeScript devDependency failure and other linked dependencies', () => {
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    assert.throws(() => checkDependencyFields({ [field]: { typescript: '6.0.3' } }),
      new RegExp(`Core must have no ${field}: npm ls traverses local links`))
  }
  assert.doesNotThrow(() => checkDependencyFields({}))
})

test('clean npm ci links core without installing its devDependencies, then npm ls checks them', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'tarkman-core-link-'))
  const app = path.join(directory, 'app')
  const core = path.join(directory, 'core')
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  const write = (filename, value) => writeFileSync(filename, JSON.stringify(value))
  const npm = (...args) => spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd: app, encoding: 'utf8', env: { ...process.env, npm_config_cache: path.join(directory, 'cache') },
  })
  try {
    mkdirSync(app)
    mkdirSync(core)
    write(path.join(app, 'package.json'), { name: 'link-probe', version: '1.0.0', dependencies: { '@tarkman/core': 'file:../core' } })
    for (const broken of [true, false]) {
      const linked = { ...manifest, ...(broken ? { devDependencies: { typescript: '6.0.3' } } : {}) }
      write(path.join(core, 'package.json'), linked)
      write(path.join(app, 'package-lock.json'), {
        name: 'link-probe', version: '1.0.0', lockfileVersion: 3, requires: true,
        packages: {
          '': { name: 'link-probe', version: '1.0.0', dependencies: { '@tarkman/core': 'file:../core' } },
          '../core': linked,
          'node_modules/@tarkman/core': { resolved: '../core', link: true },
        },
      })
      const install = npm('ci', '--offline', '--no-audit', '--no-fund')
      assert.equal(install.status, 0, install.stdout + install.stderr)
      assert.equal(existsSync(path.join(core, 'node_modules')), false)
      const list = npm('ls', '--all')
      if (broken) {
        assert.notEqual(list.status, 0)
        assert.match(list.stderr, /missing: typescript@6\.0\.3/)
      } else {
        assert.equal(list.status, 0, list.stdout + list.stderr)
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
