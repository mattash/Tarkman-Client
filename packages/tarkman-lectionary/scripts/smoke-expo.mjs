// Temporary package probe, never a shipped product route. Run after npm ci in mobile.
import { writeFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const mobile = path.join(root, 'apps/mobile')
const probe = path.join(mobile, 'app/lectionary-package-probe.tsx')
const output = process.argv[2]
if (!output || !path.isAbsolute(output)) throw Error('Supply an absolute output directory')
const source = `import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { getLectionaryDay } from '../features/lectionary'
export default function Probe() {
  const [result, setResult] = useState('Loading')
  useEffect(() => { void getLectionaryDay('2026-06-01', 'hy').then(value => setResult(JSON.stringify(value))) }, [])
  return <Text>{result}</Text>
}
`
// Exclusive create refuses to overwrite a file belonging to another task.
writeFileSync(probe, source, { flag: 'wx' })
try {
  const result = spawnSync(process.execPath, [path.join(mobile, 'node_modules/expo/bin/cli'), 'export', '--platform', 'web', '--platform', 'ios', '--platform', 'android', '--output-dir', output, '--no-minify'], { cwd: mobile, stdio: 'inherit' })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  unlinkSync(probe)
}
