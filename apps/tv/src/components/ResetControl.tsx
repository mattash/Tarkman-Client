import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useI18n } from '../i18n'
import { colors, space, type } from '../theme'
import { FocusButton } from './FocusButton'

/**
 * Erasing the TV's church display is deliberate: one press asks, a second confirms. Cancel is
 * focused first so an accidental double press cannot reset. A failed reset changes nothing.
 */
export function ResetControl({ onReset, label, testID = 'reset' }: { onReset(): Promise<void>; label?: string; testID?: string }) {
  const { t } = useI18n()
  const [stage, setStage] = useState<'idle' | 'confirm' | 'busy'>('idle')
  const [failed, setFailed] = useState(false)
  async function confirm() {
    setStage('busy'); setFailed(false)
    try { await onReset() } catch { setFailed(true); setStage('confirm') }
  }
  if (stage === 'idle') return <FocusButton testID={testID} label={label ?? t('displayMenu.reset')} onPress={() => { setFailed(false); setStage('confirm') }} />
  return (
    <View style={styles.box}>
      <Text testID={`${testID}-confirm`} style={styles.text}>{t('displayMenu.resetConfirm')}</Text>
      {failed ? <Text testID={`${testID}-failed`} accessibilityRole="alert" style={styles.text}>{t('displayMenu.resetFailed')}</Text> : null}
      <View style={styles.row}>
        <FocusButton testID={`${testID}-cancel`} label={t('displayMenu.resetCancel')} hasTVPreferredFocus onPress={() => setStage('idle')} />
        <FocusButton testID={`${testID}-yes`} label={t('displayMenu.resetYes')} disabled={stage === 'busy'} onPress={() => { void confirm() }} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: space.sm },
  text: { color: colors.textPrimary, fontSize: type.body },
  row: { flexDirection: 'row', gap: space.md },
})
