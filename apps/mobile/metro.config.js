const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('node:path')
const coreSourceRequest = require('./scripts/core-source-request')
const config = getDefaultConfig(__dirname)
config.resolver.resolveRequest = (context, moduleName, platform) => context.resolveRequest(
  context,
  coreSourceRequest(moduleName, path.dirname(context.originModulePath)),
  platform,
)
module.exports = withNativeWind(config, { input: './global.css' })
