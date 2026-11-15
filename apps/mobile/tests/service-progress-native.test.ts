import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import Constants from 'expo-constants'
import { NativeModules, Platform } from 'react-native'
import { isServiceProgressAvailable, presentServiceProgress } from '../features/service-progress/native'

jest.mock('expo-constants', () => ({ __esModule: true, default: {} }))
const originalOS = Platform.OS
const originalModule = Object.getOwnPropertyDescriptor(NativeModules, 'TarkmanServiceProgress')
const api = 'https://synthetic.invalid:9443'
const presentService = jest.fn<(id: number, origin: string) => Promise<unknown>>()
const moduleRead = jest.fn<() => unknown>()
const configRead = jest.fn<() => unknown>()
function setOS(value: string) { Object.defineProperty(Platform, 'OS', { configurable: true, value }) }
function config(value: unknown, fixture?: unknown, origin?: unknown) {
  configRead.mockReturnValue({ extra: { serviceProgressProduct: value, serviceProgressSimulatorFixture: fixture,
    serviceProgressSimulatorAPIOrigin: origin } })
}

beforeEach(() => {
  jest.clearAllMocks()
  setOS('ios')
  config(false)
  Object.defineProperty(Constants, 'expoConfig', { configurable: true, get: configRead })
  Object.defineProperty(NativeModules, 'TarkmanServiceProgress', { configurable: true, get: moduleRead })
  moduleRead.mockReturnValue({ presentService })
  presentService.mockResolvedValue('presented')
})
afterEach(() => {
  setOS(originalOS)
  delete (Constants as unknown as { expoConfig?: unknown }).expoConfig
  if (originalModule) Object.defineProperty(NativeModules, 'TarkmanServiceProgress', originalModule)
  else delete NativeModules.TarkmanServiceProgress
})

describe('lazy native service-progress presenter', () => {
  it.each([undefined, false, null, 0, 1, 'true'])('defaults off unless flag is the Boolean true (%p)', async flag => {
    config(flag)
    expect(isServiceProgressAvailable()).toBe(false)
    expect(await presentServiceProgress(77, api)).toBe('unsupported')
    expect(moduleRead).not.toHaveBeenCalled()
    expect(presentService).not.toHaveBeenCalled()
  })
  it.each(['web', 'android'])('does not read native or Expo configuration on %s', async platform => {
    setOS(platform)
    config(true)
    configRead.mockImplementation(() => { throw new Error('Configuration must not be read') })
    expect(isServiceProgressAvailable()).toBe(false)
    expect(await presentServiceProgress(77, api)).toBe('unsupported')
    expect(configRead).not.toHaveBeenCalled()
    expect(moduleRead).not.toHaveBeenCalled()
    expect(presentService).not.toHaveBeenCalled()
  })
  it('imports the facade without reading the native getter', () => {
    config(true)
    jest.isolateModules(() => { jest.requireActual('../features/service-progress/native') })
    expect(moduleRead).not.toHaveBeenCalled()
    expect(presentService).not.toHaveBeenCalled()
  })
  it.each([undefined, null, {}, { presentService: false }, { presentService: 'not callable' }])('handles an absent optional module/method (%p)', async module => {
    config(true)
    moduleRead.mockReturnValue(module)
    expect(isServiceProgressAvailable()).toBe(false)
    expect(await presentServiceProgress(77, api)).toBe('unsupported')
    expect(presentService).not.toHaveBeenCalled()
  })
  it('forwards only the exact selected service ID and explicit reader API', async () => {
    config(true)
    expect(isServiceProgressAvailable()).toBe(true)
    expect(presentService).not.toHaveBeenCalled()
    expect(await presentServiceProgress(77, api)).toBe('presented')
    expect(presentService).toHaveBeenCalledTimes(1)
    expect(presentService).toHaveBeenCalledWith(77, api)
  })
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '77', null, undefined])('rejects invalid selected service ID (%p) before native lookup', async id => {
    config(true)
    expect(await presentServiceProgress(id as number, api)).toBe('failed')
    expect(moduleRead).not.toHaveBeenCalled()
    expect(presentService).not.toHaveBeenCalled()
  })
  it.each([
    '', 'http://synthetic.invalid', 'file:///synthetic', 'https://',
    'https://user@synthetic.invalid', 'https://user:password@synthetic.invalid',
    'https://synthetic.invalid/', 'https://synthetic.invalid/path', 'https://synthetic.invalid/../',
    'https://synthetic.invalid?', 'https://synthetic.invalid?token=synthetic',
    'https://synthetic.invalid#', 'https://synthetic.invalid#fragment',
    ' https://synthetic.invalid', 'https://synthetic.invalid\n',
    'https://synthetic.invalid\\other', 'https://synthetic.invalid:99999', null, undefined,
  ])('rejects non-bare HTTPS origins (%p) before native lookup', async origin => {
    config(true)
    expect(await presentServiceProgress(77, origin as string)).toBe('failed')
    expect(moduleRead).not.toHaveBeenCalled()
    expect(presentService).not.toHaveBeenCalled()
  })
  it('admits only the exact configured Simulator fixture origin without extra arguments', async () => {
    const loopback = 'http://127.0.0.1:8765'
    config(true, true, loopback)
    expect(await presentServiceProgress(77, loopback)).toBe('presented')
    expect(presentService).toHaveBeenCalledWith(77, loopback)
    expect(presentService.mock.calls[0]).toHaveLength(2)
    expect(await presentServiceProgress(77, api)).toBe('presented') // HTTPS contract is unchanged.
  })
  it.each([undefined, false, null, 0, 1, 'true'])('does not coerce fixture flag %p into HTTP admission', async fixture => {
    config(true, fixture, 'http://127.0.0.1:8765')
    expect(await presentServiceProgress(77, 'http://127.0.0.1:8765')).toBe('failed')
    expect(moduleRead).not.toHaveBeenCalled()
  })
  it.each([undefined, false, null, 0, 1, 'true'])('does not activate product %p via fixture flag', async product => {
    config(product, true, 'http://127.0.0.1:8765')
    expect(await presentServiceProgress(77, 'http://127.0.0.1:8765')).toBe('unsupported')
    expect(moduleRead).not.toHaveBeenCalled()
  })
  it.each(['web', 'android'])('ignores even fully configured Simulator seam on %s', async platform => {
    setOS(platform)
    config(true, true, 'http://127.0.0.1:8765')
    expect(await presentServiceProgress(77, 'http://127.0.0.1:8765')).toBe('unsupported')
    expect(configRead).not.toHaveBeenCalled()
    expect(moduleRead).not.toHaveBeenCalled()
  })
  it.each([
    undefined, null, 8765, {}, '', 'http://127.0.0.1', 'http://localhost:8765', 'http://127.1:8765',
    'http://2130706433:8765', 'http://127.0.0.2:8765', 'http://[::1]:8765', 'http://127.0.0.1:0',
    'http://127.0.0.1:65536', 'http://127.0.0.1:08765', 'http://127.0.0.1:+8765',
    'http://127.0.0.1:8765/', 'http://127.0.0.1:8765/path', 'http://127.0.0.1:8765?',
    'http://127.0.0.1:8765#', 'http://user@127.0.0.1:8765', 'http://user:pass@127.0.0.1:8765',
    ' http://127.0.0.1:8765', 'http://127.0.0.1:8765\n',
  ])('rejects invalid even identically configured fixture origin %p', async origin => {
    config(true, true, origin)
    expect(await presentServiceProgress(77, origin as string)).toBe('failed')
    expect(moduleRead).not.toHaveBeenCalled()
  })
  it.each([undefined, null, 'http://127.0.0.1:8766', 'https://127.0.0.1:8765', new String('http://127.0.0.1:8765')])('rejects mismatched fixture configuration %p', async origin => {
    config(true, true, origin)
    expect(await presentServiceProgress(77, 'http://127.0.0.1:8765')).toBe('failed')
    expect(moduleRead).not.toHaveBeenCalled()
  })
  it.each([1, 80, 65535])('allows exact fixture port %p', async port => {
    const origin = `http://127.0.0.1:${port}`
    config(true, true, origin)
    expect(await presentServiceProgress(77, origin)).toBe('presented')
  })
  it.each(['presented', 'unavailable', 'failed'] as const)('preserves only truthful native result %s', async result => {
    config(true)
    presentService.mockResolvedValue(result)
    expect(await presentServiceProgress(77, api)).toBe(result)
  })
  it.each([false, true, null, undefined, {}, 'started', 'delivered', 'synthetic-secret-error'])('never treats unexpected native result as presented (%p)', async result => {
    config(true)
    presentService.mockResolvedValue(result)
    expect(await presentServiceProgress(77, api)).toBe('failed')
  })
  it('sanitizes native promise rejection without exposing the error', async () => {
    config(true)
    presentService.mockRejectedValue(new Error('synthetic-secret-native-error'))
    expect(await presentServiceProgress(77, api)).toBe('failed')
  })
  it('sanitizes native getter failure and unavailable lookup', async () => {
    config(true)
    moduleRead.mockImplementation(() => { throw new Error('synthetic-secret-getter-error') })
    expect(isServiceProgressAvailable()).toBe(false)
    expect(await presentServiceProgress(77, api)).toBe('failed')
  })
})
