import type { ManagedDisplayLink } from '@tarkman/core'
export const link: ManagedDisplayLink = {
  id: 1, token: 'token-A', user_id: 7, title: 'Sanctuary', config_version: 1,
  created_at: '2026-09-22T12:00:00Z', updated_at: '2026-09-22T12:00:00Z', expires_at: null,
  display_url: 'https://display.example.test/sessions/display?token=token-A',
  mode: 'parallel', lang1: 'translit', lang2: 'en', device_type: 'auto', font_scale: 100,
  margin_percent: null, text_movement: 'continuous', language_sync: 'linked',
  show_notifications: true, show_explanations: false, status_view: 'full',
}
export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { resolve, promise }
}
export async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve() }
