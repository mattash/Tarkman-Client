import { expect, it, jest, beforeEach } from '@jest/globals'
import { recordSpikeDiagnostic } from '../features/siri/spikeDiagnostics'

const mockRecord = jest.fn<(stage: string, id: string) => Promise<void>>()
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => ({ recordDiagnostic: (stage: string, id: string) => mockRecord(stage, id) }) }))
beforeEach(() => { mockRecord.mockReset(); mockRecord.mockResolvedValue(undefined) })
it('records only the supplied phase and invocation identifier', () => {
  recordSpikeDiagnostic('queue:received', '00000000-0000-4000-8000-000000000001')
  expect(mockRecord).toHaveBeenCalledWith('queue:received', '00000000-0000-4000-8000-000000000001')
})
it('does not throw when the optional diagnostic bridge throws', () => {
  mockRecord.mockImplementation(() => { throw new Error('unavailable') })
  expect(() => recordSpikeDiagnostic('root:ready')).not.toThrow()
})
it('handles asynchronous diagnostic failure without rejecting the action', async () => {
  mockRecord.mockRejectedValue(new Error('storage'))
  recordSpikeDiagnostic('root:ready')
  await Promise.resolve()
  expect(mockRecord).toHaveBeenCalledWith('root:ready', '')
})
