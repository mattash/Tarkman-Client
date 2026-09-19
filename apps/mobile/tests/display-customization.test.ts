import { expect, it } from '@jest/globals'
import { customization, DEFAULT_CUSTOMIZATION, normalizeCustomization, projectionLayout, independentDuration,
  createManualPosition, createPageGroup } from '../features/displayLinks/customization'
import { normalizeConfig, normalizeOverrides, mergeDisplayConfig } from '../features/displayLinks/normalize'
import { projectionPosition } from '../features/displayLinks/projectionTiming'

it('retains the existing size, margins, and timing defaults when the server omits new fields', () => {
  const config = normalizeConfig({ token: 'abc', user_id: 7 })!
  expect(customization(config)).toEqual(DEFAULT_CUSTOMIZATION)
  expect(projectionLayout(customization(config), 1920, 1080, 32)).toEqual({ textScale: 1, paddingHorizontal: 32, paddingVertical: 32 })
})
it('accepts numeric URL preferences, validates boundaries, and keeps token settings authoritative', () => {
  const url = normalizeOverrides({ font_scale: '115', margin_percent: '0', device_type: 'projector', text_movement: 'paged', language_sync: 'independent' })
  expect(url).toEqual({ font_scale: 115, margin_percent: 0, device_type: 'projector', text_movement: 'paged', language_sync: 'independent' })
  const config = normalizeConfig({ token: 'abc', user_id: 7, font_scale: 120, text_movement: 'none' })!
  expect(mergeDisplayConfig(config, url)).toMatchObject({ font_scale: 120, text_movement: 'none', device_type: 'auto', margin_percent: null })
  expect(normalizeCustomization({ font_scale: '115', margin_percent: '4' })).toEqual({})
})
it.each([false, [], {}, NaN, Infinity, 49, 201, 100.5, '100px', ''])('rejects malformed text sizes: %s', value => {
  expect(normalizeCustomization({ font_scale: value }, true)).toEqual({})
})
it('supports automatic or explicit margins, including zero, independently from a device preset', () => {
  expect(projectionLayout(customization({ device_type: 'projector' }), 1920, 1080, 32)).toEqual({ textScale: 1.15, paddingHorizontal: 76.8, paddingVertical: 43.2 })
  expect(projectionLayout(customization({ device_type: 'projector', font_scale: 200, margin_percent: 0 }), 1920, 1080, 32)).toEqual({ textScale: 2.3, paddingHorizontal: 0, paddingVertical: 0 })
  expect(normalizeCustomization({ margin_percent: null })).toEqual({ margin_percent: null })
  expect(normalizeCustomization({ margin_percent: 16, text_movement: 'loop', device_type: 'watch', language_sync: 'pixels' })).toEqual({})
})
it('uses separate translation lengths for independent timing while the longest retains the part duration', () => {
  const texts = ['one two', 'one two three four']
  expect(independentDuration(60000, texts[0], texts)).toBe(30000)
  expect(independentDuration(60000, texts[1], texts)).toBe(60000)
  expect(independentDuration(1000, null, texts)).toBe(1000)
})
it('synchronizes manual progress without feedback loops and removes listeners', () => {
  const position = createManualPosition(), received: number[] = []
  const off = position.subscribe(value => { received.push(value); position.set(value) })
  position.set(0.5); position.set(5); position.set(NaN); off(); position.set(0)
  expect(received).toEqual([0.5, 1])
  expect(position.get()).toBe(0)
})
it('turns linked pages together despite different text heights and leaves a final dwell', () => {
  const group = createPageGroup(), release = group.report('en', 4)
  group.report('grabar', 3)
  const base = { viewport: 600, lineHeight: 40, duration: 30000, reducedMotion: true, pageCount: group.get() }
  const first = projectionPosition({ ...base, content: 2000 }, 7500)
  const second = projectionPosition({ ...base, content: 1500 }, 7500)
  expect(first.y / 1400).toBeCloseTo(second.y / 900)
  expect(first.nextIn).toBe(second.nextIn)
  expect(projectionPosition({ ...base, content: 2000 }, 22500)).toMatchObject({ y: 1400, done: true })
  release()
  expect(group.get()).toBe(3)
})
