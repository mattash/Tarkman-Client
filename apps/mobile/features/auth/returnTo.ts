export const DEFAULT_RETURN_TO = '/services'

/** Accepts only in-app paths, and never the sign-in screen itself, so a link cannot loop or leave the app. */
export function safeReturnTo(value: unknown): string {
  const path = Array.isArray(value) ? value[0] : value
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\\\s]/.test(path) || /^\/sign-in(?:[/?#]|$)/.test(path)) return DEFAULT_RETURN_TO
  return path
}
