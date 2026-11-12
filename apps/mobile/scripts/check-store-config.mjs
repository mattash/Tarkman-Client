import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { expo } = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'))
const ios = expo.ios

assert.equal(ios.config?.usesNonExemptEncryption, false, 'iOS export-compliance declaration must state that only exempt encryption is used')
assert.equal(ios.supportsTablet, true, 'iPad support must remain explicit while App Store screenshots are required')

const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'))
assert.equal(eas.cli?.appVersionSource, 'remote', 'EAS must own iOS build numbers so every store upload is unique')
assert.equal(eas.build?.production?.autoIncrement, true, 'production builds must increment the remote build number')
assert.equal(ios.buildNumber, undefined, 'ios.buildNumber is ignored with a remote version source; remove it from app.json')
assert.ok(eas.submit?.production?.ios?.appleTeamId && eas.submit?.production?.ios?.ascAppId, 'the production submit profile must name the Apple team and App Store Connect app')

const projectId = expo.extra?.eas?.projectId
assert.match(projectId ?? '', /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i, 'EAS Update needs a project ID')
assert.equal(expo.updates?.url, `https://u.expo.dev/${projectId}`, 'EAS Update URL must use this app\'s project ID')
assert.deepEqual(expo.runtimeVersion, { policy: 'appVersion' }, 'EAS Update compatibility must follow the app version')
const { dependencies } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
assert.ok(dependencies?.['expo-updates'], 'the native app must include expo-updates')
for (const environment of ['preview', 'production']) {
  assert.equal(eas.build?.[environment]?.channel, environment, `${environment} builds must use their own update channel`)
  assert.equal(eas.build?.[environment]?.environment, environment, `${environment} builds must use their own EAS environment`)
}

// The iOS build image is pinned to an exact name, never an alias (`auto`, `latest`, `sdk-NN`), so an Expo-side
// change to an alias cannot move a release onto a different Xcode. SDK 58's template adopts UIScene;
// keep both the SDK and tested Xcode image pinned together (issue #243).
const IOS_IMAGE = /^macos-[a-z]+-\d+\.\d+-xcode-(\d+)\.\d+$/
const images = ['development', 'preview', 'production'].map(name => eas.build?.[name]?.ios?.image)
for (const image of images) {
  const match = IOS_IMAGE.exec(image ?? '')
  assert.ok(match, `iOS builds must pin an exact image name (macos-<os>-xcode-<version>), not ${JSON.stringify(image)}`)
  assert.equal(image, 'macos-tahoe-26.6-xcode-27.1', 'SDK 58 builds must use the reviewed Xcode 27 image')
  assert.match(dependencies.expo, /^~58\./, 'Xcode 27 requires the SDK 58 scene lifecycle')
}
assert.equal(new Set(images).size, 1, 'development, preview and production must build on the same iOS image')

const android = expo.android
assert.equal(android?.package, 'app.tarkman', 'the Android package must stay app.tarkman; a new package is a new app with new signing keys')
assert.equal(eas.build?.development?.developmentClient, true, 'the development profile must build the development client')
assert.equal(eas.build?.development?.android?.buildType, 'apk', 'development Android builds must be installable APKs')
assert.equal(eas.build?.preview?.android?.buildType, 'apk', 'preview Android builds must be installable APKs')
assert.notEqual(eas.build?.preview?.developmentClient, true, 'the preview APK must run its embedded bundle, not a development client')
assert.equal(eas.build?.preview?.distribution, 'internal', 'the preview APK is for internal installation, not store submission')
assert.equal(eas.build?.production?.android?.buildType, 'app-bundle', 'production Android builds must be Play-ready AABs')
assert.equal(eas.build?.production?.distribution, 'store', 'production builds must use store distribution')
assert.notEqual(eas.build?.production?.developmentClient, true, 'production must embed the app rather than require Metro')
assert.equal(android.versionCode, undefined, 'EAS remote versioning must own Android version codes')
assert.deepEqual(eas.submit?.['android-internal'], {
  android: { track: 'internal', releaseStatus: 'draft' },
}, 'Android submission must explicitly target an internal draft with EAS-managed credentials')
assert.deepEqual(eas.submit?.production?.ios, {
  appleTeamId: 'FHF872BAQR', ascAppId: '6810790124',
}, 'Android submission changes must preserve the existing iOS destination')
const camera = expo.plugins?.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-camera')?.[1]
assert.equal(camera?.recordAudioAndroid, false, 'QR scanning uses the camera only; Android must not request the microphone')
const location = expo.plugins?.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-location')?.[1]
assert.equal(location?.isAndroidBackgroundLocationEnabled, false, 'location is foreground-only on Android')
for (const permission of ['RECORD_AUDIO', 'ACCESS_BACKGROUND_LOCATION']) {
  assert.ok(android?.blockedPermissions?.includes(`android.permission.${permission}`), `Android must block ${permission} even if a library manifest requests it`)
}

const expectedReasons = new Map([
  ['NSPrivacyAccessedAPICategoryDiskSpace', ['E174.1', '85F4.1']],
  ['NSPrivacyAccessedAPICategoryFileTimestamp', ['0A2A.1', '3B52.1', 'C617.1']],
  ['NSPrivacyAccessedAPICategorySystemBootTime', ['35F9.1']],
  ['NSPrivacyAccessedAPICategoryUserDefaults', ['CA92.1']],
])
const actual = new Map((ios.privacyManifests?.NSPrivacyAccessedAPITypes ?? []).map(entry => [
  entry.NSPrivacyAccessedAPIType,
  entry.NSPrivacyAccessedAPITypeReasons,
]))

assert.deepEqual([...actual.keys()].sort(), [...expectedReasons.keys()].sort(), 'privacy manifest must cover exactly the linked SDK required-reason API categories')
for (const [category, reasons] of expectedReasons) {
  assert.deepEqual([...actual.get(category)].sort(), reasons.sort(), `unexpected reasons for ${category}`)
}

console.log('Store configuration checks passed: iOS declarations and destination, Android APK/AAB profiles and internal draft submission, remote versioning, and EAS Update channels. Remote credentials and Play acceptance are not checked.')
