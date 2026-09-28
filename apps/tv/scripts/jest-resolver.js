const path = require('node:path')
const createJestResolver = require('../../../tools/metro/shared-package-resolver')

module.exports = createJestResolver(path.resolve(__dirname, '..'))
