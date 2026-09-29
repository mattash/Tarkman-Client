export const DEVICE_TYPES = ['auto', 'projector', 'tv', 'tablet', 'phone'] as const
export const TEXT_MOVEMENTS = ['continuous', 'paged', 'manual', 'none'] as const
export const LANGUAGE_SYNCS = ['linked', 'independent'] as const
export type DeviceType = typeof DEVICE_TYPES[number]
export type TextMovement = typeof TEXT_MOVEMENTS[number]
export interface DisplayCustomization {
  device_type: DeviceType
  font_scale: number
  text_movement: TextMovement
  language_sync: typeof LANGUAGE_SYNCS[number]
  margin_percent: number | null
}
export const DEFAULT_CUSTOMIZATION: DisplayCustomization = {
  device_type: 'auto', font_scale: 100, text_movement: 'continuous', language_sync: 'linked', margin_percent: null,
}

/** URL strings are accepted only by the direct-link parser. Stored JSON must use numbers. */
export function normalizeCustomization(value: Record<string, unknown>, url = false): Partial<DisplayCustomization> {
  const result: Partial<DisplayCustomization> = {}
  if (DEVICE_TYPES.some(type => type === value.device_type)) result.device_type = value.device_type as DeviceType
  if (TEXT_MOVEMENTS.some(type => type === value.text_movement)) result.text_movement = value.text_movement as TextMovement
  if (LANGUAGE_SYNCS.some(type => type === value.language_sync)) result.language_sync = value.language_sync as DisplayCustomization['language_sync']
  const integer = (raw: unknown, min: number, max: number) => {
    const number = url && typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw
    return typeof number === 'number' && Number.isSafeInteger(number) && number >= min && number <= max ? number : undefined
  }
  const scale = integer(value.font_scale, 50, 200), margin = integer(value.margin_percent, 0, 15)
  if (scale !== undefined) result.font_scale = scale
  if (value.margin_percent === null || (url && value.margin_percent === '')) result.margin_percent = null
  else if (margin !== undefined) result.margin_percent = margin
  return result
}

export function customization(value: Partial<DisplayCustomization>): DisplayCustomization {
  return { ...DEFAULT_CUSTOMIZATION, ...normalizeCustomization(value) }
}

const presets: Record<DeviceType, { scale: number; margin: number | null }> = {
  auto: { scale: 1, margin: null }, projector: { scale: 1.15, margin: 4 }, tv: { scale: 1, margin: 3 },
  tablet: { scale: 0.85, margin: 2 }, phone: { scale: 0.75, margin: 2 },
}
export function projectionLayout(settings: DisplayCustomization, width: number, height: number, automaticPadding: number) {
  const preset = presets[settings.device_type]
  const margin = settings.margin_percent ?? preset.margin
  return {
    textScale: preset.scale * settings.font_scale / 100,
    paddingHorizontal: margin === null ? automaticPadding : width * margin / 100,
    paddingVertical: margin === null ? automaticPadding : height * margin / 100,
  }
}

/**
 * Status screens (page number, posture) are already sized to fill their area, so a configured
 * text scale can shrink them but never enlarge them past it. Every renderer uses this one rule.
 */
export function statusTextScale(textScale: number): number {
  return Math.min(1, textScale)
}

/** Independent translations finish according to their own lengths within the part's estimate. */
export function independentDuration(duration: number, text: string | null, texts: Array<string | null>) {
  const words = (value: string | null) => value?.trim().split(/\s+/).filter(Boolean).length ?? 0
  const longest = Math.max(1, ...texts.map(words))
  return Math.min(duration, Math.max(3000, duration * words(text) / longest))
}

/** Shared manual position avoids React renders on every scroll event and ignores feedback. */
export function createManualPosition() {
  let progress = 0
  const listeners = new Set<(value: number) => void>()
  return {
    get: () => progress,
    set(value: number) {
      const next = Math.max(0, Math.min(1, value))
      if (!Number.isFinite(next) || Math.abs(next - progress) < 0.0001) return
      progress = next
      for (const listener of listeners) listener(progress)
    },
    subscribe(listener: (value: number) => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  }
}
export type ManualPosition = ReturnType<typeof createManualPosition>

/** All linked languages turn a page together, using the denser column's page count. */
export function createPageGroup() {
  const counts = new Map<string, number>(), listeners = new Set<(count: number) => void>()
  const get = () => Math.max(1, ...counts.values())
  const publish = () => { const count = get(); for (const listener of listeners) listener(count) }
  return {
    get,
    report(id: string, count: number) { counts.set(id, count); publish(); return () => { counts.delete(id); publish() } },
    subscribe(listener: (count: number) => void) { listeners.add(listener); listener(get()); return () => { listeners.delete(listener) } },
  }
}
export type PageGroup = ReturnType<typeof createPageGroup>
