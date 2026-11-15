/* global require, module */
const fs = require('node:fs')
const path = require('node:path')
const { Buffer } = require('node:buffer')
const { withXcodeProject } = require('expo/config-plugins')
const plist = require('@expo/plist').default

const generated = 'ServiceProgressGenerated'
const widgetName = 'ServiceProgressLiveActivity'
const bundle = 'app.tarkman.progressprototype'
// Sources are COPIED at generation time from the existing implementation. Never
// edit generated copies. App-only token/HTTP/Keychain code cannot enter Widget.
const common = ['ServiceAttributes.swift', 'ServiceContentState.swift', 'ServicePublicationV1.swift',
  'ServicePublicationActivity.swift', 'ServicePublicationValidation.swift', 'ServicePublicationView.swift',
  'ServiceProgressReaderLink.swift']
const appOnly = ['ServiceRemoteExperimentConfiguration.swift', 'ServicePublicSelection.swift',
  'ServiceExperimentJournal.swift', 'ServiceExperimentKeychain.swift', 'ServiceRegistrationTransport.swift',
  'ServiceRegistrationCoordinator.swift', 'ServiceRegistrationURLSessionHTTP.swift', 'ServiceActivityRegistrationBridge.swift',
  'ServiceSimulatorFixture.swift']
const manifest = [
  ...common.map(name => [`prototypes/service-progress-ios/Shared/${name}`, `Shared/${name}`, 'common']),
  ...appOnly.map(name => [`prototypes/service-progress-ios/Shared/${name}`, `Shared/${name}`, 'app']),
  ...['ServiceRemoteExperimentController.swift', 'ServiceRemoteExperimentView.swift']
    .map(name => [`prototypes/service-progress-ios/App/${name}`, `App/${name}`, 'app']),
  ...['TarkmanServiceProgress.swift', 'TarkmanServiceProgressBridge.m']
    .map(name => [`features/service-progress/ios/${name}`, `Bridge/${name}`, 'app']),
  ['prototypes/service-progress-ios/Widget/ServiceActivityWidget.swift', 'Widget/ServiceActivityWidget.swift', 'widget'],
  ['prototypes/service-progress-ios/Widget/Info.plist', 'Widget/Info.plist', 'info'],
  ...['en', 'ru'].map(lang => [`prototypes/service-progress-ios/Resources/${lang}.lproj/Localizable.strings`,
    `Resources/${lang}.lproj/Localizable.strings`, 'resource']),
]
const unquote = value => String(value ?? '').replace(/^"|"$/g, '')
const entries = section => Object.entries(section ?? {}).filter(([key]) => !key.endsWith('_comment'))

const buildGuard = `set -eu
case "\${SERVICE_PROGRESS_BUILD_MODE:-}" in
  unsigned) ;;
  simulator)
    test "\${CONFIGURATION:-}" = Debug && test "\${PLATFORM_NAME:-}" = iphonesimulator || {
      echo "error: Service Progress Simulator seams require Debug iphonesimulator" >&2; exit 1;
    } ;;
  device)
    test "\${CONFIGURATION:-}" = Debug && test "\${PLATFORM_NAME:-}" = iphoneos || {
      echo "error: Service Progress device generation requires Debug iphoneos" >&2; exit 1;
    } ;;
  *) echo "error: Unknown Service Progress build mode" >&2; exit 1 ;;
esac
`

function guardConfiguration(config) {
  if (config.ios?.bundleIdentifier !== bundle || config.extra?.serviceProgressProduct !== true ||
      config.ios?.infoPlist?.ServiceProgressRemoteEnabled !== true) {
    throw new Error('Service Progress plugin requires the explicit isolated product variant')
  }
  const fixture = config.extra?.serviceProgressSimulatorFixture === true || config.ios.infoPlist.ServiceProgressSimulatorFixture === true
  if (fixture && (config.extra?.serviceProgressSimulatorFixture !== true || config.ios.infoPlist.ServiceProgressSimulatorFixture !== true)) {
    throw new Error('Inconsistent Simulator fixture configuration')
  }
  const http = config.extra?.serviceProgressSimulatorHTTP === true || config.ios.infoPlist.ServiceProgressSimulatorHTTP === true
  if (http && (config.extra?.serviceProgressSimulatorFixture !== true || config.ios.infoPlist.ServiceProgressSimulatorFixture !== true)) {
    throw new Error('Simulator HTTP requires the isolated Simulator fixture')
  }
  const device = config.extra?.serviceProgressDeviceBuild
  if (device) {
    const uuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    if (!/^[A-Z0-9]{10}$/.test(device.team ?? '') || !uuid.test(device.hostProfile ?? '') ||
        !uuid.test(device.extensionProfile ?? '') || device.hostProfile.toLowerCase() === device.extensionProfile.toLowerCase() ||
        config.extra.serviceProgressSimulatorHTTP || config.ios.infoPlist.ServiceProgressSimulatorHTTP ||
        config.extra.serviceProgressSimulatorFixture || config.extra.serviceProgressSimulatorAPIOrigin ||
        config.ios.infoPlist.ServiceProgressSimulatorFixture || config.ios.infoPlist.ServiceProgressSimulatorAPIOrigin ||
        JSON.stringify(config.ios.entitlements) !== JSON.stringify({ 'aps-environment': 'development' })) {
      throw new Error('Invalid isolated device generation inputs or mixed Simulator seams')
    }
  }
}

function copyInputs(projectRoot, platformRoot, config) {
  guardConfiguration(config)
  // Check EVERY source before writing any generated input; no partial missing-source success.
  for (const [source] of manifest) {
    if (!fs.statSync(path.join(projectRoot, source)).isFile()) throw new Error('Missing Service Progress source')
  }
  if (config.extra?.serviceProgressDeviceBuild) {
    const template = path.join(projectRoot, 'prototypes/service-progress-ios/App/RemoteExperiment.entitlements')
    const entitlement = plist.parse(fs.readFileSync(template, 'utf8'))
    if (JSON.stringify(entitlement) !== JSON.stringify({ 'aps-environment': 'development' })) throw new Error('Unexpected development entitlement template')
    fs.mkdirSync(path.join(platformRoot, generated, 'App'), { recursive: true })
    fs.copyFileSync(template, path.join(platformRoot, generated, 'App/RemoteExperiment.entitlements'))
    fs.mkdirSync(path.join(platformRoot, generated, 'Widget'), { recursive: true })
    fs.writeFileSync(path.join(platformRoot, generated, 'Widget/Widget.entitlements'), plist.build({}))
  } else {
    // Only our generated files: neutralize stale development authorization when
    // reusing an output directory, never touch a pre-existing app entitlement file.
    for (const relative of ['App/RemoteExperiment.entitlements', 'Widget/Widget.entitlements']) {
      const destination = path.join(platformRoot, generated, relative)
      if (fs.existsSync(destination)) fs.writeFileSync(destination, plist.build({}))
    }
  }
  for (const [source, relative, kind] of manifest) {
    const destination = path.join(platformRoot, generated, relative)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    if (kind === 'info') {
      const info = plist.parse(fs.readFileSync(path.join(projectRoot, source), 'utf8'))
      info.CFBundleShortVersionString = config.version
      info.CFBundleVersion = config.ios?.buildNumber ?? '1'
      // Never inherit a prototype's test-only handoff in ordinary product builds.
      delete info.ServiceProgressSimulatorFixture
      delete info.ServiceProgressSimulatorTapScheme
      if (config.extra?.serviceProgressSimulatorFixture === true && config.ios?.infoPlist?.ServiceProgressSimulatorFixture === true) {
        info.ServiceProgressSimulatorFixture = true
        info.ServiceProgressSimulatorTapScheme = 'tarkman-progress-dev'
      }
      fs.writeFileSync(destination, plist.build(info))
    } else fs.copyFileSync(path.join(projectRoot, source), destination)
  }
}

function applyProject(project, config) {
  guardConfiguration(config)
  const objects = project.hash.project.objects
  const attributes = project.getFirstProject().firstProject.attributes
  const ownershipKey = 'ServiceProgressDeviceOwnershipV1'
  const saved = attributes[ownershipKey]
  if (saved) {
    const state = JSON.parse(Buffer.from(unquote(saved), 'base64').toString('utf8'))
    if (state.version !== 1 || !Array.isArray(state.changes) || !Array.isArray(state.created)) throw new Error('Invalid Service Progress ownership record')
    for (const { location, present, original, applied } of state.changes) {
      const parent = location.slice(0, -1).reduce((value, key) => value?.[key], objects)
      const key = location.at(-1)
      // Do not revert a setting changed by another owner after generation.
      if (parent && JSON.stringify(parent[key]) === JSON.stringify(applied)) {
        if (present) parent[key] = original
        else delete parent[key]
      } else if (location[0] === 'PBXBuildFile' && key === 'ATTRIBUTES' && Array.isArray(parent?.[key]) &&
          !original?.includes('CodeSignOnCopy')) {
        // Membership is independently owned: keep other owners' newly added
        // embed attributes while removing only our added CodeSignOnCopy.
        parent[key] = parent[key].filter(value => value !== 'CodeSignOnCopy')
      }
    }
    for (const location of state.created.reverse()) {
      const parent = location.slice(0, -1).reduce((value, key) => value?.[key], objects)
      const key = location.at(-1)
      if (parent?.[key] && Object.keys(parent[key]).length === 0) delete parent[key]
    }
    delete attributes[ownershipKey]
    for (const [, item] of entries(objects.XCBuildConfiguration)) {
      if (item.buildSettings?.SERVICE_PROGRESS_BUILD_MODE === 'device') delete item.buildSettings.SERVICE_PROGRESS_BUILD_MODE
    }
  } else if (entries(objects.XCBuildConfiguration).some(([, item]) => item.buildSettings?.SERVICE_PROGRESS_BUILD_MODE === 'device')) {
    throw new Error('Device project lacks ownership record; regenerate rather than guessing original signing settings')
  }
  const ownership = { version: 1, changes: [], created: [] }
  function owned(location, value) {
    let parent = objects
    for (const [index, key] of location.slice(0, -1).entries()) {
      if (!Object.hasOwn(parent, key)) {
        parent[key] = {}
        ownership.created.push(location.slice(0, index + 1))
      }
      parent = parent[key]
    }
    const key = location.at(-1)
    ownership.changes.push({ location, present: Object.hasOwn(parent, key), original: parent[key], applied: value })
    parent[key] = value
  }
  const apps = entries(objects.PBXNativeTarget).filter(([, target]) => unquote(target.productType) === 'com.apple.product-type.application')
  if (apps.length !== 1 || project.getFirstTarget().uuid !== apps[0][0]) {
    // node-xcode addTarget embeds in its first target. Never silently embed in a test/other app.
    throw new Error('Service Progress requires one unambiguous first application target')
  }
  const appID = apps[0][0]
  let widget = entries(objects.PBXNativeTarget).find(([, target]) => unquote(target.name) === widgetName)
  if (!widget) {
    const created = project.addTarget(widgetName, 'app_extension', `${generated}/Widget`, `${bundle}.LiveActivity`)
    widget = [created.uuid, created.pbxNativeTarget]
  } else if (unquote(widget[1].productType) !== 'com.apple.product-type.app-extension') {
    throw new Error('Conflicting Service Progress target')
  }
  const [widgetID, widgetTarget] = widget
  function settings(targetID, values, deviceOwned = false) {
    const target = objects.PBXNativeTarget[targetID]
    const list = objects.XCConfigurationList[target.buildConfigurationList]
    for (const item of list.buildConfigurations) {
      if (deviceOwned) {
        for (const [key, value] of Object.entries(values)) owned(['XCBuildConfiguration', item.value, 'buildSettings', key], value)
      } else Object.assign(objects.XCBuildConfiguration[item.value].buildSettings, values)
    }
  }
  settings(appID, { PRODUCT_BUNDLE_IDENTIFIER: `"${bundle}"`,
    IPHONEOS_DEPLOYMENT_TARGET: '16.4', INFOPLIST_KEY_NSSupportsLiveActivities: 'YES' })
  settings(widgetID, { PRODUCT_BUNDLE_IDENTIFIER: `"${bundle}.LiveActivity"`,
    INFOPLIST_FILE: `"${generated}/Widget/Info.plist"`, GENERATE_INFOPLIST_FILE: 'NO',
    IPHONEOS_DEPLOYMENT_TARGET: '16.4', SWIFT_VERSION: '5.0', APPLICATION_EXTENSION_API_ONLY: 'YES',
    SKIP_INSTALL: 'YES', TARGETED_DEVICE_FAMILY: '"1,2"', CURRENT_PROJECT_VERSION: config.ios?.buildNumber ?? '1',
    MARKETING_VERSION: config.version, CODE_SIGNING_ALLOWED: 'NO' })
  const device = config.extra?.serviceProgressDeviceBuild
  if (device) {
    const signing = { DEVELOPMENT_TEAM: device.team, CODE_SIGN_STYLE: 'Manual', CODE_SIGN_IDENTITY: '"Apple Development"',
      CODE_SIGNING_ALLOWED: 'YES', CODE_SIGNING_REQUIRED: 'YES', SUPPORTED_PLATFORMS: 'iphoneos', SDKROOT: 'iphoneos' }
    settings(appID, { ...signing, PROVISIONING_PROFILE_SPECIFIER: `"${device.hostProfile}"`,
      CODE_SIGN_ENTITLEMENTS: `"${generated}/App/RemoteExperiment.entitlements"` }, true)
    settings(widgetID, { ...signing, PROVISIONING_PROFILE_SPECIFIER: `"${device.extensionProfile}"`,
      CODE_SIGN_ENTITLEMENTS: `"${generated}/Widget/Widget.entitlements"` }, true)
    owned(['PBXProject', project.getFirstProject().uuid, 'attributes', 'TargetAttributes', appID,
      'SystemCapabilities', 'com.apple.Push'], { enabled: 1 })
  }
  // Expo evaluation cannot know the eventual SDK/configuration. Enforce the
  // experimental build boundary in the generated targets as well, before compile.
  const simulator = config.extra?.serviceProgressSimulatorFixture === true
  const mode = device ? 'device' : simulator ? 'simulator' : 'unsigned'
  settings(appID, { SERVICE_PROGRESS_BUILD_MODE: mode })
  settings(widgetID, { SERVICE_PROGRESS_BUILD_MODE: mode })
  for (const targetID of [appID, widgetID]) {
    const target = objects.PBXNativeTarget[targetID]
    let guard = target.buildPhases.map(ref => objects.PBXShellScriptBuildPhase?.[ref.value])
      .find(item => unquote(item?.name) === 'Validate Service Progress build boundary')
    if (!guard) {
      guard = project.addBuildPhase([], 'PBXShellScriptBuildPhase', 'Validate Service Progress build boundary', targetID,
        { shellPath: '/bin/sh', shellScript: '' }).buildPhase
      const ref = target.buildPhases.pop()
      target.buildPhases.unshift(ref)
    }
    // Seal the mode in generated source, not an overridable command-line setting.
    guard.shellScript = JSON.stringify(`SERVICE_PROGRESS_BUILD_MODE=${mode}\n${buildGuard}`)
    guard.alwaysOutOfDate = 1
  }
  let groupID = project.findPBXGroupKey({ name: generated })
  if (!groupID) {
    groupID = project.pbxCreateGroup(generated)
    project.addToPbxGroup(groupID, project.getFirstProject().firstProject.mainGroup)
  }
  function phase(targetID, isa, comment) {
    const target = objects.PBXNativeTarget[targetID]
    const found = target.buildPhases.find(ref => objects[isa]?.[ref.value])
    return found ? objects[isa][found.value] : project.addBuildPhase([], isa, comment, targetID).buildPhase
  }
  function member(targetID, isa, fileRef, name) {
    const buildPhase = phase(targetID, isa, isa === 'PBXSourcesBuildPhase' ? 'Sources' : 'Resources')
    if (buildPhase.files.some(ref => objects.PBXBuildFile[ref.value]?.fileRef === fileRef)) return
    const id = project.generateUuid()
    objects.PBXBuildFile[id] = { isa: 'PBXBuildFile', fileRef, fileRef_comment: name }
    objects.PBXBuildFile[`${id}_comment`] = `${name} in ${isa === 'PBXSourcesBuildPhase' ? 'Sources' : 'Resources'}`
    buildPhase.files.push({ value: id, comment: objects.PBXBuildFile[`${id}_comment`] })
  }
  for (const [, relative, kind] of manifest.filter(([, , kind]) => ['common', 'app', 'widget'].includes(kind))) {
    const filePath = `${generated}/${relative}`
    let reference = entries(objects.PBXFileReference).find(([, ref]) => unquote(ref.path) === filePath)?.[0]
    if (!reference) reference = project.addFile(filePath, groupID).fileRef
    if (kind !== 'widget') member(appID, 'PBXSourcesBuildPhase', reference, path.basename(relative))
    if (kind !== 'app') member(widgetID, 'PBXSourcesBuildPhase', reference, path.basename(relative))
  }
  let localized = project.findPBXVariantGroupKey({ name: 'Localizable.strings' })
  if (!localized) {
    localized = project.pbxCreateVariantGroup('Localizable.strings')
    project.addToPbxGroup(localized, groupID)
    for (const language of ['en', 'ru']) {
      const resource = project.addFile(`${generated}/Resources/${language}.lproj/Localizable.strings`, localized)
      objects.PBXFileReference[resource.fileRef].name = language
      project.addKnownRegion(language)
    }
  } else if (!objects.PBXGroup[groupID].children.some(child => child.value === localized)) {
    throw new Error('Conflicting app localization group; refuse to replace existing resources')
  }
  member(appID, 'PBXResourcesBuildPhase', localized, 'Localizable.strings')
  member(widgetID, 'PBXResourcesBuildPhase', localized, 'Localizable.strings')
  // addTarget creates the dependency and a Copy Files phase with dstSubfolderSpec13.
  // Verify/label that specific embed phase rather than creating duplicate products.
  const embed = objects.PBXNativeTarget[appID].buildPhases
    .map(ref => objects.PBXCopyFilesBuildPhase?.[ref.value]).find(item => item?.files.some(ref =>
      objects.PBXBuildFile[ref.value]?.fileRef === widgetTarget.productReference))
  if (!embed || Number(embed.dstSubfolderSpec) !== 13) throw new Error('Widget embed phase missing')
  embed.name = '"Embed Service Progress Extension"'
  for (const ref of embed.files) {
    const file = objects.PBXBuildFile[ref.value]
    if (file.fileRef === widgetTarget.productReference) {
      file.settings ??= {}
      const original = file.settings.ATTRIBUTES ?? []
      if (!original.includes('RemoveHeadersOnCopy')) file.settings.ATTRIBUTES = [...original, 'RemoveHeadersOnCopy']
      if (device) owned(['PBXBuildFile', ref.value, 'settings', 'ATTRIBUTES'],
        ['CodeSignOnCopy', ...file.settings.ATTRIBUTES.filter(value => value !== 'CodeSignOnCopy')])
    }
  }
  if (device) attributes[ownershipKey] = JSON.stringify(Buffer.from(JSON.stringify(ownership)).toString('base64'))
  return project
}

function withServiceProgress(config) {
  guardConfiguration(config)
  return withXcodeProject(config, mod => {
    copyInputs(mod.modRequest.projectRoot, mod.modRequest.platformProjectRoot, mod)
    applyProject(mod.modResults, mod)
    return mod
  })
}
module.exports = withServiceProgress
module.exports.applyProject = applyProject
module.exports.copyInputs = copyInputs
module.exports.manifest = manifest
