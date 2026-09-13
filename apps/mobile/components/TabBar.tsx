import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../design/ThemeProvider'
import { touchTarget } from '../design/tokens'
import { AppIcon, type IconName } from './AppIcon'
import { AppText } from './AppText'

export interface TabItem { name: string; label: string; icon: 'tab-today' | 'tab-services' | 'tab-settings' }

/**
 * Icon plus an always-visible label. Selected ink is actionPrimary; unselected is onDisabled on the
 * surface bar (5.64:1 light, 7.24:1 dark). The bar grows with text size up to the label bound below.
 */
export function TabBar({ tabs, selected, onSelect }: { tabs: readonly TabItem[]; selected: string; onSelect(name: string): void }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', alignItems: 'flex-start', paddingTop: 9, paddingBottom: Math.max(insets.bottom, 8),
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider }}>
    {tabs.map((tab, index) => <Tab key={tab.name} tab={tab} index={index} count={tabs.length} selected={tab.name === selected} onPress={() => onSelect(tab.name)} />)}
  </View>
}

function Tab({ tab, index, count, selected, onPress }: { tab: TabItem; index: number; count: number; selected: boolean; onPress(): void }) {
  const { colors } = useTheme()
  const [pressed, setPressed] = useState(false)
  const color = selected ? colors.primary : colors.onDisabled
  return <Pressable testID={`tab-${tab.name}`} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityHint={`${index + 1} of ${count}`}
    accessibilityState={{ selected }} onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ flex: 1, minHeight: touchTarget, alignItems: 'center', gap: 3, paddingHorizontal: 4, opacity: 1,
      backgroundColor: pressed ? colors.pressedSubtle : 'transparent', borderRadius: 10 }}>
    <AppIcon name={(selected ? `${tab.icon}-selected` : tab.icon) as IconName} color={color} size={26} />
    {/* One word per third of the width cannot grow without breaking mid-word ("Service-s") or the bar
        taking a quarter of the screen, so tab labels alone stop growing at 1.6×, as UIKit tab bars do. */}
    <AppText variant="tab" maxFontSizeMultiplier={1.6} style={{ color, fontWeight: selected ? '600' : '400', textAlign: 'center' }}>{tab.label}</AppText>
  </Pressable>
}
