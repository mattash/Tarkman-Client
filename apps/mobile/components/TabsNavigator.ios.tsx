import { Platform } from 'react-native'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useTheme } from '../design/ThemeProvider'
import { JsTabsNavigator } from './JsTabsNavigator'
import type { TabItem } from './TabBar'
import { nativeTabsSupported, TAB_SYMBOLS } from './tabSymbols'

/**
 * On iOS 26 and later the system draws the tab bar (Liquid Glass, Dynamic Type, minimize on scroll).
 * Earlier iOS keeps the JS bar, so nothing changes there.
 */
export function TabsNavigator({ tabs }: { tabs: readonly TabItem[] }) {
  return nativeTabsSupported(Platform.Version) ? <NativeTabsNavigator tabs={tabs} /> : <JsTabsNavigator tabs={tabs} />
}

function NativeTabsNavigator({ tabs }: { tabs: readonly TabItem[] }) {
  const { colors } = useTheme()
  return <NativeTabs tintColor={colors.primary} minimizeBehavior="onScrollDown">
    {/* The native tab host does not inherit the stack's background, so each tab paints the app's own. */}
    {tabs.map(tab => <NativeTabs.Trigger key={tab.name} name={tab.name} contentStyle={{ backgroundColor: colors.background }}>
      <NativeTabs.Trigger.Icon sf={TAB_SYMBOLS[tab.icon]} />
      <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
    </NativeTabs.Trigger>)}
  </NativeTabs>
}
