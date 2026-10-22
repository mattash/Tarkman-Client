// Deliberately canonical: previews and local builds share the production public URL.
export const LIBRARY_LINK_HOST = 'web.tarkman.app'
export const LIBRARY_LINK_ORIGIN = `https://${LIBRARY_LINK_HOST}`

export function libraryLinkUrl(id: number): string | null {
  return Number.isSafeInteger(id) && id > 0 ? `${LIBRARY_LINK_ORIGIN}/liturgies/${id}` : null
}
export function isLibraryLink(value: string): boolean {
  const match = /^https:\/\/web\.tarkman\.app\/liturgies\/([1-9]\d*)$/.exec(value)
  return match !== null && libraryLinkUrl(Number(match[1])) === value
}
export function readLibraryId(param: unknown): number {
  return typeof param === 'string' && /^[1-9]\d*$/.test(param) && Number.isSafeInteger(Number(param)) && String(Number(param)) === param ? Number(param) : NaN
}
/** Undefined leaves other links alone; '/' rejects claimed but unsafe Library links. */
export function libraryLinkPath(value: string): string | undefined {
  try {
    const url = new URL(value)
    if (url.host !== LIBRARY_LINK_HOST || !/^\/liturgies(?:\/|$)/.test(url.pathname) || !/^https?:$/.test(url.protocol)) return undefined
    if (url.protocol !== 'https:' || url.username || url.password || /[\s\\]/.test(value)) return '/'
    const match = /^\/liturgies\/([1-9]\d*)\/?$/.exec(url.pathname)
    const id = readLibraryId(match?.[1])
    return Number.isNaN(id) ? '/' : `/liturgies/${id}`
  } catch { return undefined }
}
