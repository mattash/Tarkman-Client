import * as Clipboard from 'expo-clipboard'
import { Platform, Share } from 'react-native'

/** Strictly a persisted browser URL; no URL construction and no tokens in errors/logs. */
export function shareableUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !/[\s\\]/.test(value) &&
      /\/sessions\/(?:status\/)?display$/.test(url.pathname) && !!url.searchParams.get('token') } catch { return false }
}
export function expiredLink(expires: string | null, now = Date.now()): boolean { return expires !== null && Date.parse(expires) <= now }
export interface ShareAdapter {
  share(url: string, title: string, message: string, anchor?: number): Promise<'done' | 'cancelled' | 'copy'>
  copy(url: string): Promise<boolean>
}
export const platformShare: ShareAdapter = {
  // Called synchronously from the tap handler: no awaited fetch/save before navigator.share.
  async share(url, title, message, anchor) {
    if (!shareableUrl(url)) return 'copy'
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator.share !== 'function') return 'copy'
        await navigator.share({ title, text: message, url })
        return 'done'
      }
      if (Platform.OS === 'ios' && !anchor) return 'copy'
      const result = await Share.share({ title, message, url }, { subject: title, ...(anchor ? { anchor } : {}) })
      return result.action === Share.dismissedAction ? 'cancelled' : 'done'
    } catch (error) { return error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'copy' }
  },
  async copy(url) {
    if (!shareableUrl(url)) return false
    try {
      if (Platform.OS === 'web') { await navigator.clipboard.writeText(url); return true }
      return await Clipboard.setStringAsync(url)
    } catch { return false }
  },
}
