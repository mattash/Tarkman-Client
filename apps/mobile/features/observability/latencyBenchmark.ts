/** Opt-in marks for the local benchmark runner. Never stores content, tokens, or user attributes. */
type Fields = Record<string, string | number | boolean | null | undefined>
export interface BenchmarkContext { run: string; client: string; sessionId: number; command?: string; cycle?: string; request?: string }
export interface BenchmarkBridge extends BenchmarkContext {
  emit(event: Fields): void
}
declare global {
  var __TARKMAN_BENCHMARK__: BenchmarkBridge | undefined
}
const validId = /^[a-zA-Z0-9_-]{1,80}$/
const recoveries = new WeakMap<AbortSignal, BenchmarkContext>()
let cycle = 0, requestNumber = 0

export function benchmarkContext(sessionId?: number | null): BenchmarkContext | undefined {
  if (process.env.EXPO_PUBLIC_LATENCY_BENCHMARK !== 'true') return
  const bridge = globalThis.__TARKMAN_BENCHMARK__
  if (!bridge || !validId.test(bridge.run) || !validId.test(bridge.client) ||
    !Number.isSafeInteger(bridge.sessionId) || bridge.sessionId <= 0 ||
    (sessionId !== undefined && sessionId !== bridge.sessionId) ||
    (bridge.command !== undefined && !validId.test(bridge.command))) return
  return { run: bridge.run, client: bridge.client, sessionId: bridge.sessionId, command: bridge.command }
}

export function benchmarkMark(name: string, fields: Fields = {}, context?: BenchmarkContext): void {
  if (!context) return
  try {
    globalThis.__TARKMAN_BENCHMARK__?.emit({ name, at_ms: performance.timeOrigin + performance.now(),
      run: context.run, client: context.client, session_id: context.sessionId,
      command: context.command, cycle: context.cycle, request: context.request, ...fields })
  } catch { /* Diagnostics must not interrupt reading or controls. */ }
}

export function beginRecovery(sessionId: number | null, signal: AbortSignal, reason: string): BenchmarkContext | undefined {
  const context = benchmarkContext(sessionId)
  if (!context) return
  context.cycle = `recovery_${++cycle}`
  recoveries.set(signal, context)
  benchmarkMark('recovery.start', { reason }, context)
  return context
}

export function recoveryContext(signal: AbortSignal): BenchmarkContext | undefined { const context = recoveries.get(signal); return context ? { ...context, request: `request_${++requestNumber}` } : undefined }

/** Keep independent background work correlated with the reading that requested it. */
export function inheritRecovery(signal: AbortSignal, parent: AbortSignal): void {
  const context = recoveries.get(parent)
  if (context) recoveries.set(signal, context)
}

export function benchmarkHeaders(context?: BenchmarkContext): Record<string, string> {
  if (!context) return {}
  return { 'X-Tarkman-Benchmark-Run': context.run, 'X-Tarkman-Benchmark-Client': context.client,
    'X-Tarkman-Benchmark-Session': String(context.sessionId),
    ...(context.command ? { 'X-Tarkman-Benchmark-Command': context.command } : {}),
    ...(context.cycle ? { 'X-Tarkman-Benchmark-Cycle': context.cycle } : {}),
    ...(context.request ? { 'X-Tarkman-Benchmark-Request': context.request } : {}) }
}

export function benchmarkCable(value: unknown, sessionId: number): void {
  const context = benchmarkContext(sessionId)
  if (!context) return
  const envelope = value as { event?: unknown; data?: { part?: unknown }; benchmark?: { command?: unknown; run?: unknown } } | null
  const command = envelope?.benchmark?.command
  benchmarkMark('cable.received', { event: typeof envelope?.event === 'string' ? envelope.event : null,
    event_command: typeof command === 'string' ? command : null,
    event_run: typeof envelope?.benchmark?.run === 'string' ? envelope.benchmark.run : null,
    part_id: typeof envelope?.data?.part === 'number' ? envelope.data.part : null }, context)
}
