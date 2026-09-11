import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function checkDependencyFields(manifest) {
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    assert.equal(Object.keys(manifest[field] ?? {}).length, 0, `Core must have no ${field}: npm ls traverses local links without installing their dependencies`)
  }
}

export function checkPackage() {
  const read = relative => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'))
  checkDependencyFields(read('../package.json'))
  for (const app of ['web', 'mobile']) {
    const lock = read(`../../../apps/${app}/package-lock.json`)
    assert.deepEqual(lock.packages['node_modules/@tarkman/core'], {
      resolved: '../../packages/tarkman-core',
      link: true,
    })
    const linked = lock.packages['../../packages/tarkman-core']
    assert.ok(linked, `${app}: missing core link metadata`)
    checkDependencyFields(linked)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkPackage()
  console.log('Core manifest and both app locks have dependency-free local links')
}
