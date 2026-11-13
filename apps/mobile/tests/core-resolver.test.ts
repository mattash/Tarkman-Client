import { expect, it, jest } from '@jest/globals'
import path from 'node:path'
import coreSourceRequest from '../scripts/core-source-request'
import resolve from '../scripts/jest-resolver'

const coreSource = path.resolve(__dirname, '../../../packages/tarkman-core/src')

it('maps core internal explicit .js requests to source TypeScript', () => {
  expect(coreSourceRequest('./status.js', coreSource)).toBe('./status.ts')
  expect(coreSourceRequest('../status.js', path.join(coreSource, 'nested'))).toBe('../status.ts')
})

it.each([
  ['./status.js', __dirname],
  ['./status.js', path.resolve(__dirname, '../node_modules/third-party')],
  ['./status.js', coreSource + '-other'],
  ['../outside.js', coreSource],
  ['some-package/index.js', coreSource],
  ['/absolute/status.js', coreSource],
  ['./status', coreSource],
  ['./status.json', coreSource],
])('leaves %s from %s unchanged', (request, basedir) => {
  expect(coreSourceRequest(request, basedir)).toBe(request)
})

it('delegates to Jest with the original resolver options', () => {
  const defaultResolver = jest.fn<(request: string, options: object) => string>(() => 'resolved')
  const options = { basedir: coreSource, defaultResolver }
  expect(resolve('./status.js', options)).toBe('resolved')
  expect(defaultResolver).toHaveBeenCalledWith('./status.ts', options)
})

it('resolves bare imports from shared packages against this app, not a parent node_modules', () => {
  const defaultResolver = jest.fn<(request: string, options: object) => string>(() => 'resolved')
  const reader = path.resolve(__dirname, '../../../packages/tarkman-reader/src')
  const appRoot = path.resolve(__dirname, '..')
  resolve('@babel/runtime/helpers/interopRequireDefault', { basedir: reader, defaultResolver })
  expect(defaultResolver).toHaveBeenLastCalledWith('@babel/runtime/helpers/interopRequireDefault', { basedir: appRoot, defaultResolver })
  resolve('./adapters', { basedir: reader, defaultResolver })
  expect(defaultResolver).toHaveBeenLastCalledWith('./adapters', { basedir: reader, defaultResolver })
  resolve('react', { basedir: __dirname, defaultResolver })
  expect(defaultResolver).toHaveBeenLastCalledWith('react', { basedir: __dirname, defaultResolver })
})
