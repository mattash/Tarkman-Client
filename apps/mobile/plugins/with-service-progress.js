/* global require, module */
const fs = require('node:fs')
const path = require('node:path')
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

function guardConfiguration(config) {
  if (config.ios?.bundleIdentifier !== bundle || config.extra?.serviceProgressProduct !== true ||
      config.ios?.infoPlist?.ServiceProgressRemoteEnabled !== true) {
    throw new Error('Service Progress plugin requires the explicit isolated product variant')
  }
}

function copyInputs(projectRoot, platformRoot, config) {
  guardConfiguration(config)
  // Check EVERY source before writing any generated input; no partial missing-source success.
  for (const [source] of manifest) {
    if (!fs.statSync(path.join(projectRoot, source)).isFile()) throw new Error('Missing Service Progress source')
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
  function settings(targetID, values) {
    const target = objects.PBXNativeTarget[targetID]
    const list = objects.XCConfigurationList[target.buildConfigurationList]
    for (const item of list.buildConfigurations) Object.assign(objects.XCBuildConfiguration[item.value].buildSettings, values)
  }
  settings(appID, { PRODUCT_BUNDLE_IDENTIFIER: `"${bundle}"`,
    IPHONEOS_DEPLOYMENT_TARGET: '16.4', INFOPLIST_KEY_NSSupportsLiveActivities: 'YES' })
  settings(widgetID, { PRODUCT_BUNDLE_IDENTIFIER: `"${bundle}.LiveActivity"`,
    INFOPLIST_FILE: `"${generated}/Widget/Info.plist"`, GENERATE_INFOPLIST_FILE: 'NO',
    IPHONEOS_DEPLOYMENT_TARGET: '16.4', SWIFT_VERSION: '5.0', APPLICATION_EXTENSION_API_ONLY: 'YES',
    SKIP_INSTALL: 'YES', TARGETED_DEVICE_FAMILY: '"1,2"', CURRENT_PROJECT_VERSION: config.ios?.buildNumber ?? '1',
    MARKETING_VERSION: config.version, CODE_SIGNING_ALLOWED: 'NO' })
  // No team, aps-environment, push capability or profile is added. A future real
  // token run STILL requires an explicitly enabled, reviewed APNs profile gate.
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
    if (file.fileRef === widgetTarget.productReference) file.settings = { ATTRIBUTES: ['RemoveHeadersOnCopy'] }
  }
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
