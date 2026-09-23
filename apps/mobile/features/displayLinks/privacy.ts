/** Capability-bearing route/network metadata must not reach automatic telemetry. */
export function redactDisplayCapabilities<T>(value: T): T {
  function visit(item: unknown, depth: number): unknown {
    if (depth > 20) return undefined
    if (typeof item === 'string') return /(?:display[_-]links\/[^\s/?#]+|[?&]token=)/i.test(item) ? '[display link redacted]' : item
    if (Array.isArray(item)) return item.map(child => visit(child, depth + 1))
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).filter(([key]) =>
      !['token', 'display_url'].includes(key.toLowerCase())).map(([key, child]) => [key, visit(child, depth + 1)]))
    return item
  }
  return visit(value, 0) as T
}
