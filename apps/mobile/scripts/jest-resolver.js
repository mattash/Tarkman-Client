const path = require('node:path')
const createJestResolver = require('../../../tools/metro/shared-package-resolver')

// Shared with apps/tv; see tools/metro/shared-package-resolver.js.
module.exports = createJestResolver(path.resolve(__dirname, '..'))
