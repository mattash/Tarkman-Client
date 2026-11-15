// This gate changes source generation only, never provisioning or runtime consent.
module.exports = ({ config }) => {
  const flag = process.env.TARKMAN_SERVICE_PROGRESS_PRODUCT ?? '0'
  if (flag !== '0' && flag !== '1') throw new Error('TARKMAN_SERVICE_PROGRESS_PRODUCT must be 0 or 1')
  const simulator = process.env.TARKMAN_SERVICE_PROGRESS_SIMULATOR ?? '0'
  if (simulator !== '0' && simulator !== '1') throw new Error('TARKMAN_SERVICE_PROGRESS_SIMULATOR must be 0 or 1')
  if (simulator === '1' && flag !== '1') throw new Error('Simulator fixture requires the isolated product variant')
  // Preserve the exact default graph; do not even load the experimental plugin.
  if (flag === '0') return config
  const origin = key => {
    const value = process.env[key]
    try {
      const url = new URL(value)
      if (!value || url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
          url.search || url.hash || url.pathname !== '/' || url.origin !== value ||
          (url.port && (Number(url.port) < 1 || Number(url.port) > 65535)) || /[\s\\]/.test(value)) throw new Error()
      return value
    } catch { throw new Error(`Explicit bare HTTPS origin required: ${key}`) }
  }
  const fixture = simulator === '1'
  const sealedOrigin = (key, value) => {
    if (process.env[key] !== undefined && process.env[key] !== value) {
      throw new Error(`Simulator fixture requires reserved origin: ${key}`)
    }
    return value
  }
  let simulatorAPI
  if (fixture) {
    simulatorAPI = process.env.SERVICE_PROGRESS_SIMULATOR_API_ORIGIN
    const match = typeof simulatorAPI === 'string' && /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/.exec(simulatorAPI)
    if (!match || match[0] !== simulatorAPI || Number(match[1]) > 65535) throw new Error('Explicit bare HTTP loopback origin required: SERVICE_PROGRESS_SIMULATOR_API_ORIGIN')
  }
  const backend = fixture ? sealedOrigin('SERVICE_PROGRESS_DEVELOPMENT_ORIGIN', 'https://backend.service-progress.invalid') : origin('SERVICE_PROGRESS_DEVELOPMENT_ORIGIN')
  const reader = fixture ? sealedOrigin('SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN', 'https://reader.service-progress.invalid') : origin('SERVICE_PROGRESS_DEVELOPMENT_READER_ORIGIN')
  const next = JSON.parse(JSON.stringify(config))
  next.name = 'Tarkman Progress Dev'
  next.slug = 'tarkman-service-progress-product-dev'
  next.scheme = 'tarkman-progress-dev'
  next.platforms = ['ios']
  delete next.owner
  next.updates = { enabled: false }
  delete next.extra?.eas
  next.extra = { ...next.extra, serviceProgressProduct: true }
  if (fixture) Object.assign(next.extra, { serviceProgressSimulatorFixture: true, serviceProgressSimulatorAPIOrigin: simulatorAPI })
  next.ios = { ...next.ios, bundleIdentifier: 'app.tarkman.progressprototype' }
  delete next.ios.associatedDomains
  next.ios.infoPlist = { ...next.ios.infoPlist, NSSupportsLiveActivities: true,
    ServiceProgressRemoteEnabled: true, ServiceProgressDevelopmentOrigin: backend,
    ServiceProgressDevelopmentReaderOrigin: reader }
  if (fixture) Object.assign(next.ios.infoPlist, { ServiceProgressSimulatorFixture: true, ServiceProgressSimulatorAPIOrigin: simulatorAPI })
  next.plugins = [...(next.plugins ?? []), './plugins/with-service-progress']
  return next
}
