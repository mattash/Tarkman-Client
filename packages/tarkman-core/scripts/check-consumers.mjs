import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, unlinkSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const probe = readFileSync(new URL('../tests/contracts.types.ts', import.meta.url), 'utf8')
const entry = realpathSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)))
for (const app of ['web', 'mobile']) {
  const root = new URL(`../../../apps/${app}/`, import.meta.url)
  const require = createRequire(new URL('package.json', root))
  assert.equal(realpathSync(require.resolve('@tarkman/core')), entry)
  const filename = fileURLToPath(new URL(`.core-contract-probe-${process.pid}.ts`, root))
  const originalDirectory = process.cwd()
  try {
    process.chdir(fileURLToPath(root))
    writeFileSync(filename, probe, { flag: 'wx' })
    const ts = require('typescript')
    const configFile = fileURLToPath(new URL('tsconfig.json', root))
    const config = ts.readConfigFile(configFile, ts.sys.readFile)
    assert.equal(config.error, undefined)
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, fileURLToPath(root))
    assert.equal(parsed.errors.length, 0)
    const program = ts.createProgram([filename], { ...parsed.options, noEmit: true })
    const diagnostics = ts.getPreEmitDiagnostics(program)
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => fileURLToPath(root),
      getCanonicalFileName: name => name,
      getNewLine: () => '\n',
    }))
    console.log(`${app}: public package resolution and live/fixed/future compile probes passed`)
  } finally {
    process.chdir(originalDirectory)
    unlinkSync(filename)
  }
}
