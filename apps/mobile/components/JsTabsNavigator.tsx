import { Tabs } from 'expo-router'
import { useTheme } from '../design/ThemeProvider'
import { TabBar, type TabItem } from './TabBar'

/** The JS tab bar: web, Android, and iOS before 26. */
export function JsTabsNavigator({ tabs }: { tabs: readonly TabItem[] }) {
  const { colors } = useTheme()
  return <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    tabBar={({ state, navigation }) => <TabBar tabs={tabs} selected={state.routes[state.index].name} onSelect={name => {
      const route = state.routes.find(candidate => candidate.name === name)
      if (!route) return
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
      if (!event.defaultPrevented && state.routes[state.index].name !== name) navigation.navigate(name)
    }} />}>
    {tabs.map(tab => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />)}
  </Tabs>
}
