const path = require('node:path')
const coreSourceRequest = require('./core-source-request')

function isInside(root, directory) {
  const relative = path.relative(root, directory)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

/**
 * A Jest resolver for an app that consumes packages/* from source. Core's .js specifiers map to its
 * TypeScript, and packages/* (which have no node_modules) resolve bare imports, including helpers Babel
 * injects such as @babel/runtime, from the app, never from a node_modules above the repository.
 */
module.exports = function createJestResolver(appRoot) {
  const packagesRoot = path.resolve(appRoot, '../../packages')
  return (request, options) => {
    const mapped = coreSourceRequest(request, options.basedir)
    const bare = !mapped.startsWith('.') && !path.isAbsolute(mapped)
    return options.defaultResolver(mapped, bare && isInside(packagesRoot, options.basedir) ? { ...options, basedir: appRoot } : options)
  }
}
