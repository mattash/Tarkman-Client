import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { AppText } from '../../components/AppText'
import { LiturgyText } from '../../components/LiturgyText'
import { spacing } from '../../design/tokens'
import type { LiveExplanation } from './contracts'
import type { ExplanationBatch } from './explanationCue'

export function ExplanationSheetContent({ explanations, batch, presentation, onPresented }: {
  explanations: LiveExplanation[]; batch: ExplanationBatch | null; presentation: object | null
  onPresented(batch: ExplanationBatch, presentation: object): void
}) {
  const [laidOut, setLaidOut] = useState(false)
  // Same-size edits and foreground/focus return need a new commit, not another layout/show event.
  useEffect(() => {
    if (laidOut && batch && presentation) onPresented(batch, presentation)
  }, [laidOut, batch, presentation, onPresented])
  return <View testID="explanation-collection" onLayout={() => setLaidOut(true)} style={{ gap: spacing.md }}>
    {explanations.map(explanation => <View key={explanation.id} style={{ gap: spacing.sm }}>
      <AppText variant="heading">{explanation.title}</AppText><LiturgyText variant="explanation" text={explanation.description} blocks />
    </View>)}
  </View>
}
