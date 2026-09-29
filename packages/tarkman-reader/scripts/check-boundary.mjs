// The reader engine is bundled by two apps that resolve different react-native packages
// (react-native in apps/mobile, react-native-tvos in apps/tv). It stays safe to share only while it
// imports nothing that either app resolves: no React, React Native, Expo or app modules, and no
// build-time globals that only one app's bundler defines. Types from @tarkman/core are allowed.
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'src')
const specifier = /\b(?:import|export)\s+(type\s+)?[^'"]*?\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
const forbiddenGlobals = [/\b__DEV__\b/, /\bprocess\.env\b/, /\bwindow\./, /\bdocument\./, /\bnavigator\./, /\blocalStorage\b/]
const findings = []

for (const entry of readdirSync(source, { recursive: true })) {
  const file = join(source, entry)
  if (!/\.tsx?$/.test(file)) continue
  const name = relative(root, file)
  if (file.endsWith('.tsx')) findings.push(`${name}: JSX belongs in the apps, not the engine`)
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(specifier)) {
    const [, typeOnly, from, dynamic, required] = match
    const target = from ?? dynamic ?? required
    if (target.startsWith('./') || target.startsWith('../')) {
      if (resolve(dirname(file), target).startsWith(source + '/')) continue
    } else if (target === '@tarkman/core' && typeOnly) continue
    findings.push(`${name}: import of '${target}'${target === '@tarkman/core' ? ' must be type-only' : ''}`)
  }
  text.split('\n').forEach((line, index) => {
    const code = line.replace(/\/\/.*$/, '')
    for (const pattern of forbiddenGlobals) if (pattern.test(code)) findings.push(`${name}:${index + 1}: platform global ${pattern.source}`)
  })
}

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
  if (manifest[field]) findings.push(`package.json: ${field} is not allowed; apps provide every runtime`)
}

if (findings.length) {
  console.error(`Reader boundary violations:\n${findings.map(f => `  ${f}`).join('\n')}`)
  process.exit(1)
}
console.log('Reader boundary OK')
