import { useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { HeaderIconButton, ScreenHeader } from '../../components/ScreenHeader'
import { SegmentedControl } from '../../components/SegmentedControl'
import { spacing } from '../../design/tokens'
import { ServicesList } from '../home/ServicesList'
import { useI18n } from '../i18n'
import { LibraryScreen } from './LibraryScreen'
export function Services() {
  const [value, setValue] = useState<'live' | 'library'>('live'), { t } = useI18n()
  return <View style={{ flex: 1 }}>
    <View style={{ paddingTop: spacing.xs, paddingHorizontal: spacing.page }}>
      <ScreenHeader title={t('servicesList.title')}>
        {value === 'live' && <HeaderIconButton icon="scan" label={t('common.scanACode')} onPress={() => router.push('/scan')} />}
      </ScreenHeader>
      <SegmentedControl<'live' | 'library'> label={t('servicesList.title')} value={value} onChange={setValue}
        options={[{ value: 'live', label: t('library.live') }, { value: 'library', label: t('library.title') }]} />
    </View>
    {value === 'live' ? <ServicesList embedded /> : <LibraryScreen />}
  </View>
}
