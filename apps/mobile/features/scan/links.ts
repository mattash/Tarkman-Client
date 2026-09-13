/**
 * A scanned code is untrusted: anyone can replace a printed sticker. Only Tarkman reading
 * links are ever opened, and only as in-app navigation; everything else is reported, not followed.
 */
export type ScannedLink =
  | { kind: 'service'; sessionId: number; path: string }
  | { kind: 'part'; sessionId: number; partId: number; path: string }
  | { kind: 'unknown' }

const HOSTS = ['www.tarkman.app', 'tarkman.app', 'web.tarkman.app']

export function readScannedLink(value: string): ScannedLink {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return { kind: 'unknown' }
  }
  // Only HTTPS on a Tarkman host: no other scheme, no look-alike domain, no embedded credentials.
  if (url.protocol !== 'https:' || url.username || url.password || !HOSTS.includes(url.hostname.toLowerCase())) {
    return { kind: 'unknown' }
  }

  // The printed codes point at the Rails explain page for a service.
  const explain = /^\/s\/(\d+)\/explain\/?$/.exec(url.pathname)
  if (explain) return service(Number(explain[1]))

  const reading = /^\/sessions\/(\d+)\/parts\/?$/.exec(url.pathname)
  if (reading) return service(Number(reading[1]))

  const part = /^\/sessions\/(\d+)\/part\/(\d+)\/?$/.exec(url.pathname)
  if (part) {
    const sessionId = Number(part[1]), partId = Number(part[2])
    if (!positive(sessionId) || !positive(partId)) return { kind: 'unknown' }
    return { kind: 'part', sessionId, partId, path: `/sessions/${sessionId}/part/${partId}` }
  }

  return { kind: 'unknown' }
}

function service(sessionId: number): ScannedLink {
  if (!positive(sessionId)) return { kind: 'unknown' }
  return { kind: 'service', sessionId, path: `/sessions/${sessionId}/parts` }
}

function positive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}
