const coreSourceRequest = require('./core-source-request')

module.exports = (request, options) => options.defaultResolver(
  coreSourceRequest(request, options.basedir), options,
)
