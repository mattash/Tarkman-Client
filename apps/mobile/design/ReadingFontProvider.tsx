import { useEffect, useState, type PropsWithChildren } from 'react'
import { loadAsync } from 'expo-font'
import { View } from 'react-native'
import { AppText } from '../components/AppText'
import { AppButton } from '../components/AppButton'

import { ReadingFontContext } from './readingFont'
const fonts = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro static assets.
  'SourceSerif4-Regular': require('../assets/fonts/SourceSerif4-Regular.ttf'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro static assets.
  'SourceSerif4-Semibold': require('../assets/fonts/SourceSerif4-Semibold.ttf'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro static assets.
  'NotoSerifArmenian-Regular': require('../assets/fonts/NotoSerifArmenian-Regular.ttf'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro static assets.
  'NotoSerifArmenian-Bold': require('../assets/fonts/NotoSerifArmenian-Bold.ttf'),
}
export function ReadingFontProvider({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    let active = true
    loadAsync(fonts).then(() => { if (active) setStatus('ready') }, () => { if (active) setStatus('error') })
    return () => { active = false }
  }, [attempt])
  return <ReadingFontContext.Provider value={status === 'ready'}>
    {status !== 'ready' && <View className="p-page gap-2">
      <AppText variant="caption" accessibilityLiveRegion="polite" accessibilityRole={status === 'error' ? 'alert' : undefined}>
        {status === 'error' ? 'Reading font unavailable. Using system fonts; Armenian marks may vary.' : 'Loading reading font. Using system fonts; Armenian marks may vary.'}
      </AppText>
      {status === 'error' && <AppButton variant="secondary" onPress={() => { setStatus('loading'); setAttempt(value => value + 1) }}>Retry reading font</AppButton>}
    </View>}
    {children}
  </ReadingFontContext.Provider>
}
