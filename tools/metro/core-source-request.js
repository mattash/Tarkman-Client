const path = require('node:path')

const coreSource = path.resolve(__dirname, '../../packages/tarkman-core/src')

function isInsideCore(filename) {
  const relative = path.relative(coreSource, filename)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

// Core keeps NodeNext-compatible .js specifiers while consumers load its TS source.
// Never rewrite imports from app code, third-party packages, or outside core/src.
module.exports = function coreSourceRequest(request, basedir) {
  if (!isInsideCore(basedir) || !/^\.{1,2}\//.test(request) || !request.endsWith('.js')) return request
  const target = path.resolve(basedir, request)
  return isInsideCore(target) ? request.slice(0, -3) + '.ts' : request
}
