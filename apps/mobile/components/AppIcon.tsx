import { Text } from 'react-native'
import glyphs from '@react-native-vector-icons/ionicons/glyphmaps/Ionicons.json'
import { useReadingFont } from '../design/readingFont'

const names = {
  info: 'information-circle-outline', back: 'chevron-back', next: 'chevron-forward', up: 'chevron-up', down: 'chevron-down', languages: 'language-outline',
  explanation: 'book-outline', preferences: 'options-outline', close: 'close-outline',
  selected: 'checkmark', checkbox: 'checkbox-outline', unchecked: 'square-outline',
  more: 'ellipsis-horizontal', live: 'sync-outline', alert: 'alert-circle-outline',
  paused: 'pause', offline: 'cloud-offline-outline', connected: 'radio-button-on',
  scan: 'scan-outline', location: 'location-outline',
  // Tab glyphs are separate entries from explanation/preferences: they draw at 26pt and fill when selected.
  'tab-today': 'radio-outline', 'tab-today-selected': 'radio',
  'tab-services': 'book-outline', 'tab-services-selected': 'book',
  'tab-settings': 'options-outline', 'tab-settings-selected': 'options',
} as const
export type IconName = keyof typeof names

export function AppIcon({ name, color, size = 22 }: { name: IconName; color: string; size?: number }) {
  const ready = useReadingFont()
  // Only decorative glyphs have a fixed scale; every user-facing label scales.
  return <Text accessible={false} importantForAccessibility="no" maxFontSizeMultiplier={1}
    style={{ fontFamily: 'TarkmanIcons', fontSize: size, lineHeight: size + 2, width: size + 2, color, textAlign: 'center' }}>
    {ready ? String.fromCodePoint(glyphs[names[name]]) : ''}
  </Text>
}
