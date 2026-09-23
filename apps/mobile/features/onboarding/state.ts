export const ONBOARDING_KEY = 'tarkman.onboarding.v1'
export const STEPS = ['follow', 'language', 'explanation', 'preferences'] as const
export type Step = typeof STEPS[number]
export type Tip = 'return' | 'explanation'
export type Feature = Tip | 'language' | 'preferences'
export interface OnboardingRecord {
  schema: 1; content: 1; cardDismissed: boolean; invitationPresented: boolean
  status: 'notStarted' | 'inProgress' | 'completed' | 'skipped'
  checkpoint: Step; suppressed: boolean
  presented: Tip[]; dismissed: Tip[]; used: Feature[]; explanationTaught: boolean
}
export const initialOnboarding: OnboardingRecord = {
  schema: 1, content: 1, cardDismissed: false, invitationPresented: false, status: 'notStarted',
  checkpoint: 'follow', suppressed: false, presented: [], dismissed: [], used: [], explanationTaught: false,
}
export function readOnboarding(raw: string | null): OnboardingRecord {
  if (!raw) return { ...initialOnboarding }
  try {
    const r = JSON.parse(raw)
    if (!r || r.schema !== 1 || (!Number.isInteger(r.content) || r.content < 1) || !STEPS.includes(r.checkpoint)
      || !['notStarted', 'inProgress', 'completed', 'skipped'].includes(r.status)
      || ['cardDismissed', 'invitationPresented', 'suppressed', 'explanationTaught'].some(k => typeof r[k] !== 'boolean')
      || !['presented', 'dismissed', 'used'].every(k => Array.isArray(r[k]) && r[k].every((v: unknown) =>
        (k === 'used' ? ['return', 'explanation', 'language', 'preferences'] : ['return', 'explanation']).includes(v as string)))) return { ...initialOnboarding }
    // A newer content record keeps learned topics when opening an older build. Never replay old education.
    return { ...initialOnboarding, ...r, content: 1, ...(r.content > 1 ? { invitationPresented: true, suppressed: true, cardDismissed: true } : {}) }
  } catch { return { ...initialOnboarding } }
}
export function tipEligible(record: OnboardingRecord, tip: Tip, sessionUsed: boolean): boolean {
  return !sessionUsed && !record.suppressed && !record.presented.includes(tip) && !record.dismissed.includes(tip)
    && !record.used.includes(tip) && (tip !== 'explanation' || !record.explanationTaught && record.status !== 'completed')
}
