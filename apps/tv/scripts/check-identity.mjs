// Release identity guard. The TV app ships on the existing Tarkman App Store record (same bundle ID,
// team and App Store Connect app) but must never share mobile's update stream: a phone OTA bundle
// reaching a TV binary would run phone code against the tvOS runtime.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tv = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = file => JSON.parse(readFileSync(file, 'utf8'))
const tvApp = read(join(tv, 'app.json')).expo, mobileApp = read(join(tv, '../mobile/app.json')).expo
const tvEas = read(join(tv, 'eas.json')), mobileEas = read(join(tv, '../mobile/eas.json'))
const failures = []
const check = (ok, message) => { if (!ok) failures.push(message) }

check(tvApp.ios?.bundleIdentifier === mobileApp.ios?.bundleIdentifier, 'TV bundle ID must match the existing App Store record (mobile ios.bundleIdentifier)')
const plugin = (tvApp.plugins ?? []).find(p => (Array.isArray(p) ? p[0] : p) === '@react-native-tvos/config-tv')
check(Array.isArray(plugin) && plugin[1]?.isTV === true, '@react-native-tvos/config-tv must be configured with isTV: true')
// An otherwise valid tvOS IPA can upload successfully and then fail Apple's processing
// without its brand asset catalog (ITMS-90513). Require every plugin input before build.
const imageSizes = {
  icon: [1280, 768], iconSmall: [400, 240], iconSmall2x: [800, 480],
  topShelf: [1920, 720], topShelf2x: [3840, 1440],
  topShelfWide: [2320, 720], topShelfWide2x: [4640, 1440],
}
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
for (const [name, [width, height]] of Object.entries(imageSizes)) {
  const imagePath = plugin?.[1]?.appleTVImages?.[name]
  if (typeof imagePath !== 'string' || !imagePath) {
    check(false, `appleTVImages.${name} must point to a ${width}x${height} PNG`)
    continue
  }
  try {
    const image = readFileSync(join(tv, imagePath))
    const isPng = image.length >= 33 && image.subarray(0, 8).equals(pngSignature) && image.toString('ascii', 12, 16) === 'IHDR'
    check(isPng, `${imagePath} must be a PNG`)
    if (isPng) {
      check(image.readUInt32BE(16) === width && image.readUInt32BE(20) === height, `${imagePath} must be ${width}x${height}`)
      check(image[25] === 2, `${imagePath} must be an opaque RGB PNG`)
    }
  } catch {
    check(false, `${imagePath} must exist and be readable`)
  }
}
check(tvApp.slug !== mobileApp.slug, 'TV needs its own Expo slug')
check(/^macos-[a-z]+-\d+\.\d+-xcode-\d+\.\d+$/.test(tvEas.build?.base?.ios?.image ?? ''), 'TV builds must pin an exact iOS image name, not an alias')
check(tvEas.build?.base?.ios?.image === mobileEas.build?.production?.ios?.image, 'TV must build on the same pinned iOS image as mobile')

const mobileProject = mobileApp.extra?.eas?.projectId, tvProject = tvApp.extra?.eas?.projectId
check(!tvProject || tvProject !== mobileProject, 'TV must not use the mobile EAS project')
check(!JSON.stringify(tvApp.updates ?? {}).includes(mobileProject), 'TV updates URL must not point at the mobile EAS project')
check(!tvApp.updates?.url || (tvProject && tvApp.updates.url.endsWith(tvProject)), 'TV updates URL must belong to the TV EAS project')

const mobileChannels = new Set(Object.values(mobileEas.build ?? {}).map(p => p.channel).filter(Boolean))
for (const [name, profile] of Object.entries(tvEas.build ?? {})) {
  if (profile.channel) check(profile.channel.startsWith('tv-') && !mobileChannels.has(profile.channel), `build.${name}.channel must be a tv- channel distinct from mobile's`)
  const env = { ...(tvEas.build[profile.extends]?.env ?? {}), ...(profile.env ?? {}) }
  check(env.EXPO_TV === '1', `build.${name} must set EXPO_TV=1`)
}
const submit = tvEas.submit?.production?.ios, mobileSubmit = mobileEas.submit?.production?.ios
check(submit?.ascAppId === mobileSubmit?.ascAppId && submit?.appleTeamId === mobileSubmit?.appleTeamId, 'TV submits to the same App Store Connect app and team as mobile')

if (failures.length) { console.error(`TV identity check failed:\n${failures.map(f => `  ${f}`).join('\n')}`); process.exit(1) }
console.log(`TV identity OK: ${tvApp.ios.bundleIdentifier} → ASC ${submit.ascAppId}; EAS project ${tvProject ?? '(not yet initialised)'}; channels ${[...new Set(Object.values(tvEas.build).map(p => p.channel).filter(Boolean))].join(', ')}`)
