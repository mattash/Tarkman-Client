const { getDefaultConfig } = require('expo/metro-config')
const { guardReactNative } = require('../../tools/metro/single-react-native')

const config = getDefaultConfig(__dirname)
// Shared packages/* are bundled from source; react and react-native must come only from this app's
// react-native-tvos install. See apps/tv/README.md, "One React Native per app".
config.resolver.resolveRequest = guardReactNative(__dirname, 'react-native-tvos',
  (context, moduleName, platform) => context.resolveRequest(context, moduleName, platform))
module.exports = config
