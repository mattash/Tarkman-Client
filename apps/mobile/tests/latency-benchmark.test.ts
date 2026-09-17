import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'
import { benchmarkContext, benchmarkHeaders, benchmarkMark, beginRecovery, recoveryContext, inheritRecovery } from '../features/observability/latencyBenchmark'
import { createApi } from '../features/live/api'
import { createServiceControls } from '../features/services/controls'

describe('latency benchmark isolation and correlation', () => {
  const original = process.env.EXPO_PUBLIC_LATENCY_BENCHMARK
  beforeEach(() => {
    process.env.EXPO_PUBLIC_LATENCY_BENCHMARK = 'true'
    globalThis.__TARKMAN_BENCHMARK__ = { run: 'run_1', client: 'reader_1', sessionId: 4008, command: 'command_1', emit: jest.fn() }
  })
  afterEach(() => {
    process.env.EXPO_PUBLIC_LATENCY_BENCHMARK = original
    delete globalThis.__TARKMAN_BENCHMARK__
  })

  it('does not send diagnostic headers or marks when disabled or controlling another session', async () => {
    const request = jest.fn<typeof fetch>().mockResolvedValue({ ok: true, status: 200 } as Response)
    await createServiceControls(request).next(123, 1)
    expect(request.mock.calls[0][1]?.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(globalThis.__TARKMAN_BENCHMARK__!.emit).not.toHaveBeenCalled()
    process.env.EXPO_PUBLIC_LATENCY_BENCHMARK = 'false'
    await createServiceControls(request).next(4008, 1)
    expect(request.mock.calls[1][1]?.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('keeps a recovery associated with its original command even when the next command is armed', async () => {
    const signal = new AbortController().signal
    beginRecovery(4008, signal, 'cable')
    globalThis.__TARKMAN_BENCHMARK__!.command = 'command_2'
    const request = jest.fn<typeof fetch>().mockResolvedValue({ ok: true, status: 200, json: async () => ({ session: { id: 4008 } }) } as Response)
    await createApi('https://example.test', request).session(4008, signal)
    expect(request.mock.calls[0][1]?.headers).toMatchObject({ 'X-Tarkman-Benchmark-Command': 'command_1' })
    const emit = globalThis.__TARKMAN_BENCHMARK__!.emit as jest.Mock<(event: { command: string }) => void>
    expect(emit.mock.calls.map(([event]) => event.command)).toEqual(['command_1', 'command_1', 'command_1', 'command_1'])
  })

  it('identifies both session checks separately without changing the recovery identity', () => {
    const signal = new AbortController().signal
    beginRecovery(4008, signal, 'cable')
    const first = recoveryContext(signal), second = recoveryContext(signal)
    expect(first!.cycle).toBe(second!.cycle)
    expect(first!.request).not.toBe(second!.request)
    expect(benchmarkHeaders(undefined)).toEqual({})
  })

  it('keeps background explanations correlated with their original recovery and independently abortable', async () => {
    const parent = new AbortController(), background = new AbortController()
    const originalRecovery = beginRecovery(4008, parent.signal, 'cable')
    globalThis.__TARKMAN_BENCHMARK__!.command = 'command_2'
    inheritRecovery(background.signal, parent.signal)
    parent.abort()
    const request = jest.fn<typeof fetch>().mockResolvedValue({ ok: true, status: 200, json: async () => ({ explanations: [] }) } as Response)
    await createApi('https://example.test', request).explanations(4008, background.signal)
    expect(request.mock.calls[0][1]?.headers).toMatchObject({
      'X-Tarkman-Benchmark-Command': 'command_1', 'X-Tarkman-Benchmark-Cycle': originalRecovery!.cycle,
    })
    expect(background.signal.aborted).toBe(false)
  })

  it('never turns telemetry failure into a failed command', async () => {
    globalThis.__TARKMAN_BENCHMARK__!.emit = () => { throw new Error('collector unavailable') }
    expect(() => benchmarkMark('control.tap', {}, benchmarkContext(4008))).not.toThrow()
    const request = jest.fn<typeof fetch>().mockResolvedValue({ ok: true, status: 200 } as Response)
    await expect(createServiceControls(request).next(4008, 1)).resolves.toBeUndefined()
    expect(request).toHaveBeenCalledTimes(1)
  })
})
