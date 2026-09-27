import { View } from 'react-native'
import { router } from 'expo-router'
import { BackButton } from '../components/BackButton'
import { LibraryScreen } from '../features/library/LibraryScreen'
import { useI18n } from '../features/i18n'
export default function LibraryManagementScreen() {
  const { t } = useI18n()
  return <View style={{ flex: 1 }}><BackButton onPress={() => router.back()}>{t('common.settings')}</BackButton><LibraryScreen /></View>
}
