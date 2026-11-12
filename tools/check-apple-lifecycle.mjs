import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Run after prebuild for either app; native projects are generated, never committed.
const app = resolve(process.argv[2] ?? 'apps/mobile')
const read = file => readFileSync(resolve(app, 'ios', file), 'utf8')
const plist = read('Tarkman/Info.plist')
const project = read('Tarkman.xcodeproj/project.pbxproj')
assert.match(plist, /<key>UIApplicationSceneManifest<\/key>/)
assert.match(plist, /<key>UISceneDelegateClassName<\/key>\s*<string>\$\(PRODUCT_MODULE_NAME\)\.SceneDelegate<\/string>/)
assert.match(read('Tarkman/SceneDelegate.swift'), /class SceneDelegate: ExpoAppSceneDelegate/)
assert.match(project, /SceneDelegate.swift in Sources/)
assert.doesNotMatch(read('Tarkman/AppDelegate.swift'), /window = UIWindow\(frame:/)
const targets = [...project.matchAll(/(?:IPHONEOS|TVOS)_DEPLOYMENT_TARGET = ([\d.]+);/g)]
assert.ok(targets.length > 0, 'native project must declare its deployment target')
for (const [, target] of targets) assert.equal(target, '16.4', 'retain the 16.4 deployment target')
console.log(`${app}: upstream Expo scene lifecycle and deployment target 16.4 verified`)
