// Pins the compatibility gate: Expo SDK 57 ships React Native 0.86, so TV bundles react-native-tvos 0.86.x
// installed as react-native, alongside the same React as mobile. Fails before a confusing native build does.
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tv = join(dirname(fileURLToPath(import.meta.url)), '..')
const installed = name => JSON.parse(readFileSync(join(tv, 'node_modules', name, 'package.json'), 'utf8'))
const rn = installed('react-native'), expo = installed('expo'), react = installed('react')
const mobile = JSON.parse(readFileSync(join(tv, '../mobile/package.json'), 'utf8')).dependencies
const failures = []
if (rn.name !== 'react-native-tvos') failures.push(`react-native is ${rn.name}; expected the react-native-tvos alias`)
if (!expo.version.startsWith('57.')) failures.push(`expo ${expo.version}; the TV gate was validated on SDK 57`)
if (rn.version.split('-')[0] !== mobile['react-native']) failures.push(`react-native-tvos ${rn.version} does not track mobile's react-native ${mobile['react-native']}`)
if (react.version !== mobile.react) failures.push(`react ${react.version} differs from mobile's ${mobile.react}`)
// npm nests upstream react-native under any dependency whose peer range the fork's prerelease version
// misses (for example @react-native-tvos/virtualized-lists). package.json "overrides" prevents it.
const copies = readdirSync(join(tv, 'node_modules'), { recursive: true })
  .filter(file => /(^|\/)node_modules\/react-native\/package\.json$/.test(`node_modules/${file}`))
if (copies.length !== 1) failures.push(`found ${copies.length} react-native installs; expected exactly one: ${copies.join(', ')}`)
if (failures.length) { console.error(failures.join('\n')); process.exit(1) }
console.log(`TV runtime OK: expo ${expo.version}, ${rn.name} ${rn.version}, react ${react.version}`)
