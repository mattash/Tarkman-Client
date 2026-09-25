/** Public, credential-free reader destination; never derive it from the API endpoint. */
export function sessionReaderUrl(sessionId: number): string {
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) throw new RangeError('Invalid session ID') // i18n-ignore: programmer error, not interface copy
  return `https://web.tarkman.app/sessions/${sessionId}/parts`
}
