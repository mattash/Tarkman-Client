const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const { withNativeWind } = require('nativewind/metro')
const path = require('node:path')
const coreSourceRequest = require('./scripts/core-source-request')
const { guardReactNative } = require('../../tools/metro/single-react-native')
// Sentry's Expo config adds debug IDs, so uploaded source maps match the bundle a release build ships.
const config = getSentryExpoConfig(__dirname)
// apps/tv bundles react-native-tvos from the same packages/*; each app must resolve only its own React Native.
config.resolver.resolveRequest = guardReactNative(__dirname, 'react-native', (context, moduleName, platform) => context.resolveRequest(
  context,
  coreSourceRequest(moduleName, path.dirname(context.originModulePath)),
  platform,
))
module.exports = withNativeWind(config, { input: './global.css' })
