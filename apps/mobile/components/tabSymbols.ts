import type { SFSymbol } from 'sf-symbols-typescript'
import type { TabItem } from './TabBar'

/** The native tab bar's icons, one SF Symbol per tab, matching the JS bar's glyphs. */
export const TAB_SYMBOLS = {
  'tab-today': 'dot.radiowaves.left.and.right',
  'tab-services': 'book',
  'tab-settings': 'slider.horizontal.3',
  'tab-about': 'info.circle',
} as const satisfies Record<TabItem['icon'], SFSymbol>

/** Liquid Glass tab bars need iOS 26. Older iOS keeps the JS bar exactly as it was. */
export const NATIVE_TABS_MIN_IOS = 26

/** `Platform.Version` is a string such as "26.5" on iOS; anything unreadable counts as unsupported. */
export function nativeTabsSupported(version: string | number): boolean {
  const major = typeof version === 'number' ? version : Number.parseInt(version, 10)
  return Number.isFinite(major) && major >= NATIVE_TABS_MIN_IOS
}
