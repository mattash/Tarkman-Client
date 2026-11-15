/* global process */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)
const configure = require('../app.config.js')
const base = require('../app.json').expo
const keys = ['TARKMAN_SERVICE_PROGRESS_PRODUCT', 'SERVICE_PROGRESS_DEVELOPMENT_ORIGIN', 'SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN',
  'TARKMAN_SERVICE_PROGRESS_SIMULATOR', 'SERVICE_PROGRESS_SIMULATOR_API_ORIGIN']
function config(flag, backend = 'https://backend.example.invalid', reader = 'https://reader.example.invalid', simulator, simulatorAPI) {
  const previous = keys.map(key => process.env[key])
  for (const [index, value] of [flag, backend, reader, simulator, simulatorAPI].entries()) {
    if (value === undefined || value === null) delete process.env[keys[index]]
    else process.env[keys[index]] = value
  }
  try { return configure({ config: base }) }
  finally { keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index] }) }
}
const unquote = value => String(value ?? '').replace(/^"|"$/g, '')
const realEntries = section => Object.entries(section ?? {}).filter(([key]) => !key.endsWith('_comment'))
function fixture() {
  const project = require('xcode').project('synthetic.pbxproj')
  project.hash = { project: { archiveVersion: 1, objectVersion: 56, classes: {}, rootObject: 'A00000000000000000000001', objects: {
    PBXProject: { 'A00000000000000000000001': { isa: 'PBXProject', mainGroup: 'A00000000000000000000002',
      targets: [{ value: 'A00000000000000000000003', comment: 'Tarkman' }], knownRegions: ['en'], attributes: {} } },
    PBXGroup: { 'A00000000000000000000002': { isa: 'PBXGroup', children: [], sourceTree: '"<group>"' } },
    PBXNativeTarget: { 'A00000000000000000000003': { isa: 'PBXNativeTarget', name: 'Tarkman',
      productType: '"com.apple.product-type.application"', buildConfigurationList: 'A00000000000000000000004', buildPhases: [], dependencies: [], buildRules: [] } },
    XCConfigurationList: { 'A00000000000000000000004': { isa: 'XCConfigurationList', buildConfigurations: [
      { value: 'A00000000000000000000005', comment: 'Debug' }, { value: 'A00000000000000000000006', comment: 'Release' }] } },
    XCBuildConfiguration: { 'A00000000000000000000005': { isa: 'XCBuildConfiguration', name: 'Debug', buildSettings: { PRODUCT_BUNDLE_IDENTIFIER: 'app.tarkman.progressprototype' } },
      'A00000000000000000000006': { isa: 'XCBuildConfiguration', name: 'Release', buildSettings: { PRODUCT_BUNDLE_IDENTIFIER: 'app.tarkman.progressprototype' } } },
    PBXFileReference: {}, PBXBuildFile: {}, PBXTargetDependency: {}, PBXContainerItemProxy: {},
  } } }
  return project
}

test('default and zero preserve exact graph and never require experimental plugin', () => {
  const original = JSON.stringify(base)
  const pluginPath = require.resolve('../plugins/with-service-progress.js')
  assert.equal(require.cache[pluginPath], undefined)
  assert.strictEqual(config(undefined), base)
  assert.strictEqual(config('0', 'invalid', 'invalid'), base)
  assert.equal(require.cache[pluginPath], undefined)
  assert.equal(JSON.stringify(base), original)
  assert.equal(base.ios.bundleIdentifier, 'app.tarkman')
  assert.equal(base.extra.serviceProgressProduct, undefined)
  assert.ok(!base.plugins.some(plugin => String(plugin).includes('service-progress')))
})

test('explicit isolated iOS variant removes production association and OTA graph', () => {
  const result = config('1')
  assert.equal(result.ios.bundleIdentifier, 'app.tarkman.progressprototype')
  assert.equal(result.scheme, 'tarkman-progress-dev')
  assert.equal(result.name, 'Tarkman Progress Dev')
  assert.deepEqual(result.platforms, ['ios'])
  assert.equal(result.owner, undefined)
  assert.equal(result.extra.eas, undefined)
  assert.equal(result.ios.associatedDomains, undefined)
  assert.deepEqual(result.updates, { enabled: false })
  assert.equal(result.extra.serviceProgressProduct, true)
  assert.equal(result.ios.infoPlist.ServiceProgressRemoteEnabled, true)
  assert.equal(result.ios.infoPlist.ServiceProgressDevelopmentOrigin, 'https://backend.example.invalid')
  assert.equal(result.ios.infoPlist.ServiceProgressDevelopmentReaderOrigin, 'https://reader.example.invalid')
  assert.equal(result.ios.infoPlist.NSSupportsLiveActivities, true)
  assert.equal(result.ios.entitlements, base.ios.entitlements)
  assert.deepEqual(result.plugins, [...base.plugins, './plugins/with-service-progress'])
  assert.equal(base.ios.bundleIdentifier, 'app.tarkman')
})

test('bad flags and missing/non-bare/non-HTTPS origins fail closed', () => {
  for (const flag of ['', 'true', 'false', '01', ' 1', '2']) assert.throws(() => config(flag))
  for (const origin of ['', 'http://backend.example.invalid', 'https://user@backend.example.invalid',
    'https://user:password@backend.example.invalid', 'https://backend.example.invalid/',
    'https://backend.example.invalid/path', 'https://backend.example.invalid?', 'https://backend.example.invalid#',
    'https://backend.example.invalid?q=1', 'https://backend.example.invalid#fragment', ' https://backend.example.invalid',
    'https://backend.example.invalid\n', 'https://backend.example.invalid:0', 'https://backend.example.invalid:65536']) {
    assert.throws(() => config('1', origin))
    assert.throws(() => config('1', 'https://backend.example.invalid', origin))
  }
  assert.throws(() => config('1', null))
  assert.throws(() => config('1', 'https://backend.example.invalid', null))
})

const loopback = 'http://127.0.0.1:8765'
function simulatorConfig(backend = null, reader = null, api = loopback) {
  return config('1', backend, reader, '1', api)
}
const invalidLoopbacks = [undefined, '', 'http://127.0.0.1', 'http://localhost:8765', 'https://127.0.0.1:8765',
  'http://127.0.0.2:8765', 'http://127.1:8765', 'http://2130706433:8765', 'http://[::1]:8765',
  'http://127.0.0.1:0', 'http://127.0.0.1:65536', 'http://127.0.0.1:08765', 'http://127.0.0.1:+8765',
  `${loopback}/`, `${loopback}/path`, `${loopback}?`, `${loopback}#`, `${loopback}?token=fake`,
  `${loopback}#fragment`, ` ${loopback}`, `${loopback}\n`, 'http://user@127.0.0.1:8765',
  'http://user:pass@127.0.0.1:8765', `${loopback}\\path`]

test('Simulator fixture is explicit, sealed, isolated, and exact', () => {
  const selected = simulatorConfig()
  assert.equal(selected.extra.serviceProgressProduct, true)
  assert.equal(selected.extra.serviceProgressSimulatorFixture, true)
  assert.equal(selected.extra.serviceProgressSimulatorAPIOrigin, loopback)
  assert.equal(selected.ios.infoPlist.ServiceProgressSimulatorFixture, true)
  assert.equal(selected.ios.infoPlist.ServiceProgressSimulatorAPIOrigin, loopback)
  assert.equal(selected.ios.infoPlist.ServiceProgressDevelopmentOrigin, 'https://backend.service-progress.invalid')
  assert.equal(selected.ios.infoPlist.ServiceProgressDevelopmentReaderOrigin, 'https://reader.service-progress.invalid')
  assert.equal(selected.ios.bundleIdentifier, 'app.tarkman.progressprototype')
  assert.equal(selected.scheme, 'tarkman-progress-dev')
  assert.deepEqual(selected.ios.entitlements, base.ios.entitlements)
  assert.deepEqual(simulatorConfig('https://backend.service-progress.invalid', 'https://reader.service-progress.invalid'), selected)
  for (const port of [1, 80, 65535]) assert.equal(simulatorConfig(null, null, `http://127.0.0.1:${port}`).extra.serviceProgressSimulatorAPIOrigin, `http://127.0.0.1:${port}`)
  for (const origin of invalidLoopbacks) assert.throws(() => config('1', null, null, '1', origin))
  for (const origin of ['', 'https://real.example', 'https://backend.service-progress.invalid/']) assert.throws(() => simulatorConfig(origin))
  for (const origin of ['', 'https://real.example', 'https://reader.service-progress.invalid/']) assert.throws(() => simulatorConfig(null, origin))
})

test('Simulator flag cannot activate product or leak into ordinary config', () => {
  for (const product of [undefined, '0']) assert.throws(() => config(product, null, null, '1', loopback))
  for (const flag of ['', 'true', 'false', '01', ' 1', '2']) {
    assert.throws(() => config('1', null, null, flag, loopback))
    assert.throws(() => config('0', null, null, flag, loopback))
  }
  assert.strictEqual(config('0', null, null, '0', loopback), base)
  const product = config('1', undefined, undefined, '0', loopback)
  assert.equal(product.extra.serviceProgressSimulatorFixture, undefined)
  assert.equal(product.extra.serviceProgressSimulatorAPIOrigin, undefined)
  assert.equal(product.ios.infoPlist.ServiceProgressSimulatorFixture, undefined)
  assert.equal(product.ios.infoPlist.ServiceProgressSimulatorAPIOrigin, undefined)
  assert.throws(() => config('1', null, null, '0', loopback))
})

test('actual node-xcode graph has isolated extension/embed and exact source boundaries, idempotently', () => {
  const plugin = require('../plugins/with-service-progress.js')
  const project = fixture()
  assert.throws(() => plugin.applyProject(project, base))
  const selected = config('1')
  plugin.applyProject(project, selected)
  const objects = project.hash.project.objects
  const targets = realEntries(objects.PBXNativeTarget)
  assert.equal(targets.length, 2)
  const [appID] = targets.find(([, target]) => unquote(target.productType) === 'com.apple.product-type.application')
  const [widgetID, widget] = targets.find(([, target]) => unquote(target.name) === 'ServiceProgressLiveActivity')
  function membership(targetID, isa) {
    return objects.PBXNativeTarget[targetID].buildPhases.flatMap(ref => objects[isa]?.[ref.value]?.files ?? [])
      .map(ref => objects.PBXBuildFile[ref.value].fileRef)
  }
  function sources(targetID) {
    return membership(targetID, 'PBXSourcesBuildPhase').map(ref => unquote(objects.PBXFileReference[ref].path)).sort()
  }
  const expected = kind => plugin.manifest.filter(([, , role]) => role === 'common' || role === kind)
    .map(([, relative]) => `ServiceProgressGenerated/${relative}`).sort()
  assert.deepEqual(sources(appID), expected('app'))
  assert.deepEqual(sources(widgetID), expected('widget'))
  assert.ok(sources(appID).some(file => file.endsWith('/ServiceSimulatorFixture.swift')))
  assert.ok(!sources(widgetID).some(file => file.endsWith('/ServiceSimulatorFixture.swift')))
  for (const target of [appID, widgetID]) assert.ok(sources(target).some(file => file.endsWith('/ServiceProgressReaderLink.swift')))
  assert.ok(!sources(widgetID).some(file => /Keychain|Journal|HTTP|Transport|Controller|Bridge/.test(file)))
  assert.ok(!sources(appID).some(file => file.endsWith('PrototypeApp.swift')))
  assert.equal(membership(appID, 'PBXResourcesBuildPhase').length, 1)
  assert.deepEqual(membership(appID, 'PBXResourcesBuildPhase'), membership(widgetID, 'PBXResourcesBuildPhase'))
  const localized = objects.PBXVariantGroup[membership(appID, 'PBXResourcesBuildPhase')[0]]
  assert.equal(localized.children.length, 2)
  for (const child of localized.children) assert.match(unquote(objects.PBXFileReference[child.value].path), /Resources\/(en|ru)\.lproj\/Localizable.strings$/)
  const phases = objects.PBXNativeTarget[appID].buildPhases.map(ref => objects.PBXCopyFilesBuildPhase?.[ref.value]).filter(Boolean)
  assert.equal(phases.length, 1)
  assert.equal(Number(phases[0].dstSubfolderSpec), 13)
  assert.equal(objects.PBXBuildFile[phases[0].files[0].value].fileRef, widget.productReference)
  assert.deepEqual(objects.PBXBuildFile[phases[0].files[0].value].settings.ATTRIBUTES, ['RemoveHeadersOnCopy'])
  assert.equal(objects.PBXNativeTarget[appID].dependencies.length, 1)
  for (const [, build] of realEntries(objects.XCBuildConfiguration)) {
    assert.equal(build.buildSettings.IPHONEOS_DEPLOYMENT_TARGET, '16.4')
    assert.equal(build.buildSettings.DEVELOPMENT_TEAM, undefined)
    assert.equal(build.buildSettings.CODE_SIGN_ENTITLEMENTS, undefined)
  }
  const text = project.writeSync()
  plugin.applyProject(project, selected)
  assert.equal(project.writeSync(), text)
  assert.ok(!text.includes('aps-environment'))
  assert.ok(!text.includes('app.tarkman.LiveActivity'))
})

test('generated inputs copy single sources and matching widget version; no source/autolink writes', t => {
  const plugin = require('../plugins/with-service-progress.js')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'service-progress-config-'))
  t.after(() => { assert.ok(directory.startsWith(path.join(os.tmpdir(), 'service-progress-config-'))); fs.rmSync(directory, { recursive: true, force: true }) })
  const root = path.join(directory, 'input')
  const output = path.join(directory, 'ios')
  const mobile = path.resolve(import.meta.dirname, '..')
  for (const [source] of plugin.manifest) {
    const target = path.join(root, source)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const existing = path.join(mobile, source)
    fs.writeFileSync(target, fs.existsSync(existing) ? fs.readFileSync(existing) : '// synthetic bridge fixture, not a native compile\n')
  }
  const snapshot = plugin.manifest.map(([source]) => fs.readFileSync(path.join(root, source)))
  plugin.copyInputs(root, output, config('1'))
  for (const [index, [source, relative, kind]] of plugin.manifest.entries()) {
    const copied = fs.readFileSync(path.join(output, 'ServiceProgressGenerated', relative))
    assert.deepEqual(fs.readFileSync(path.join(root, source)), snapshot[index])
    if (kind !== 'info') assert.deepEqual(copied, snapshot[index])
    else {
      const info = require('@expo/plist').default.parse(copied.toString())
      assert.equal(info.CFBundleShortVersionString, base.version)
      assert.equal(info.NSExtension.NSExtensionPointIdentifier, 'com.apple.widgetkit-extension')
      assert.equal(info.ServiceProgressSimulatorFixture, undefined)
      assert.equal(info.ServiceProgressSimulatorTapScheme, undefined)
    }
  }
  const widgetInfo = path.join(output, 'ServiceProgressGenerated/Widget/Info.plist')
  const parseInfo = () => require('@expo/plist').default.parse(fs.readFileSync(widgetInfo, 'utf8'))
  plugin.copyInputs(root, output, simulatorConfig())
  assert.equal(parseInfo().ServiceProgressSimulatorFixture, true)
  assert.equal(parseInfo().ServiceProgressSimulatorTapScheme, 'tarkman-progress-dev')
  const simulatorInfo = fs.readFileSync(widgetInfo, 'utf8')
  plugin.copyInputs(root, output, simulatorConfig())
  assert.equal(fs.readFileSync(widgetInfo, 'utf8'), simulatorInfo)
  plugin.copyInputs(root, output, config('1'))
  assert.equal(parseInfo().ServiceProgressSimulatorFixture, undefined)
  assert.equal(parseInfo().ServiceProgressSimulatorTapScheme, undefined)
  const project = fixture()
  plugin.applyProject(project, simulatorConfig())
  const file = path.join(directory, 'fixture.pbxproj')
  fs.writeFileSync(file, project.writeSync())
  const parsed = require('xcode').project(file).parseSync()
  assert.equal(realEntries(parsed.hash.project.objects.PBXNativeTarget).length, 2)
  const parsedText = parsed.writeSync()
  plugin.applyProject(parsed, config('1'))
  assert.equal(parsed.writeSync(), parsedText, 'idempotent after actual serialization/parse')
  assert.equal(plugin.manifest.some(([source]) => /podspec|expo-module|package.json|entitlements/.test(source)), false)
})
