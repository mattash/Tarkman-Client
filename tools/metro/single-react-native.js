const fs = require('node:fs')
const path = require('node:path')

// apps/mobile bundles react-native; apps/tv bundles react-native-tvos, installed under the same name.
// The apps share source packages (packages/*) but never node_modules. This guard makes that a build
// invariant rather than an accident of layout: every react / react-native request, from any file in
// the graph (including packages/*), must resolve inside the app's own node_modules, to the fork the app
// declared. A stray install at the repository root or inside a package fails the bundle.
const guarded = /^(react|react-native|react-dom|scheduler)(\/|$)/

function packageName(appRoot) {
  return JSON.parse(fs.readFileSync(path.join(appRoot, 'node_modules/react-native/package.json'), 'utf8')).name
}

/**
 * @param {string} appRoot the app directory (metro's projectRoot)
 * @param {'react-native' | 'react-native-tvos'} expected the package the app must bundle as react-native
 * @param {(context: any, moduleName: string, platform: string | null) => any} resolve the resolver to guard
 */
function guardReactNative(appRoot, expected, resolve) {
  const actual = packageName(appRoot)
  if (actual !== expected) throw new Error(`${appRoot} installs ${actual} as react-native; expected ${expected}. Run npm ci in this app.`)
  const modules = fs.realpathSync(path.join(appRoot, 'node_modules')) + path.sep
  const packages = path.resolve(appRoot, '../../packages') + path.sep
  const appOrigin = path.join(appRoot, 'package.json')
  return (context, moduleName, platform) => {
    // packages/* have no node_modules: their bare imports resolve as if the app made them, never
    // from a node_modules that happens to sit above the repository.
    const bare = !moduleName.startsWith('.') && !path.isAbsolute(moduleName)
    const fromShared = bare && context.originModulePath.startsWith(packages)
    const result = resolve(fromShared ? { ...context, originModulePath: appOrigin } : context, moduleName, platform)
    const match = guarded.exec(moduleName)
    if (match && result.type === 'sourceFile') {
      const file = fs.realpathSync(result.filePath)
      // Expo replaces RN's HMR client with its own implementation on native platforms.
      // Allow only that request/destination pair, still rejecting foreign or symlinked Expo copies.
      const expoHmr = /^react-native\/Libraries\/Utilities\/HMRClient(?:\.js)?$/.test(moduleName)
        && file === path.join(modules, 'expo/src/async-require/hmr.ts')
      if (expoHmr) return result
      const root = modules + match[1] + path.sep
      // A nested copy (node_modules/react-native/node_modules/react-native) also starts with root.
      if (!file.startsWith(root) || file.slice(root.length).split(path.sep).includes('node_modules')) {
        throw new Error(`${moduleName} from ${context.originModulePath} resolved to ${file}, outside ${modules}. Each app must bundle its own ${match[1]}.`)
      }
    }
    return result
  }
}

module.exports = { guardReactNative }
