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

console.log('App Store configuration is complete for export compliance, iPad support, required-reason API declarations, and remote build numbers.')
