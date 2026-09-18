import { ScrollView } from 'react-native'
import { Tabs } from 'expo-router'
import { AppText } from '../../components/AppText'
import { TabBar, type TabItem } from '../../components/TabBar'
import { useTheme } from '../../design/ThemeProvider'
import { spacing } from '../../design/tokens'
import { ServicesProvider } from '../../features/home/ServicesProvider'
import { readerConfig } from '../../features/live/config'
import { useI18n, type MessageKey } from '../../features/i18n'

const TABS = [
  { name: 'index', label: 'tabs.today', icon: 'tab-today' },
  { name: 'live', label: 'tabs.services', icon: 'tab-services' },
  { name: 'settings', label: 'tabs.settings', icon: 'tab-settings' },
  { name: 'about', label: 'tabs.about', icon: 'tab-about' },
] as const satisfies readonly (Omit<TabItem, 'label'> & { label: MessageKey })[]

/** Today · Services · Settings · About. My services and sign-in live behind About, never in the bar. */
export default function TabsLayout() {
  const { colors } = useTheme()
  const config = readerConfig()
  const { t } = useI18n()
  const tabs: readonly TabItem[] = TABS.map(tab => ({ ...tab, label: t(tab.label) }))
  if (!config.endpoints) return <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, maxWidth: 760, alignSelf: 'center' }}>
    <AppText variant="title">{t('tabs.notConfiguredTitle')}</AppText>
    <AppText accessibilityRole="alert">{config.error}</AppText>
  </ScrollView>
  return <ServicesProvider endpoints={config.endpoints}>
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
      tabBar={({ state, navigation }) => <TabBar tabs={tabs} selected={state.routes[state.index].name} onSelect={name => {
        const route = state.routes.find(candidate => candidate.name === name)
        if (!route) return
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
        if (!event.defaultPrevented && state.routes[state.index].name !== name) navigation.navigate(name)
      }} />}>
      {tabs.map(tab => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />)}
    </Tabs>
  </ServicesProvider>
}
