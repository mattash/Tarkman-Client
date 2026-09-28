const path = require('node:path')
const coreSourceRequest = require('./core-source-request')

const appRoot = path.resolve(__dirname, '..')
const packagesRoot = path.resolve(appRoot, '../../packages')

function isInside(root, directory) {
  const relative = path.relative(root, directory)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

// Shared packages/* have no node_modules. A bare import from their source (including helpers
// Babel injects, such as @babel/runtime) resolves from this app, never from whatever
// node_modules happens to sit above the repository.
module.exports = (request, options) => {
  const mapped = coreSourceRequest(request, options.basedir)
  const bare = !mapped.startsWith('.') && !path.isAbsolute(mapped)
  return options.defaultResolver(mapped, bare && isInside(packagesRoot, options.basedir) ? { ...options, basedir: appRoot } : options)
}
