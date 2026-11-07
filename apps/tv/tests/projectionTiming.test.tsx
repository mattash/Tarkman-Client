import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo, ScrollView } from 'react-native'
import { createContinuousGroup, createPageGroup, createProjectionClock, projectionPosition, type DisplayPreferences } from '@tarkman/reader'
import { ProjectionText, type ScrollMetrics } from '../src/components/ProjectionText'
import { DisplayScreen } from '../src/screens/DisplayScreen'
import { I18nProvider } from '../src/i18n'
import { PreferencesProvider, TV_DISPLAY_DEFAULTS } from '../src/preferences'
import { endpoints, fakeServer } from './fakeServer'

const tick = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms) }) }
const remote = async (eventType: string) => { await act(async () => { (globalThis as unknown as { remote(e: string): void }).remote(eventType) }) }
const measure = async (index: number, content: number, viewport = 200) => {
  const column = screen.getAllByTestId('projection-text-scroll')[index]
  await fireEvent(column, 'layout', { nativeEvent: { layout: { width: 800, height: viewport } } })
  await fireEvent(column, 'contentSizeChange', 800, content)
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
})
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })

describe('TV projection geometry and shared timing', () => {
  it('reports actual continuous offsets and keeps linked columns aligned after remeasurement', async () => {
    const clock = createProjectionClock(), continuousGroup = createContinuousGroup()
    clock.setRunning(true)
    let first: ScrollMetrics = { maximum: 0, viewport: 0, progress: 0 }, second = first
    await render(<I18nProvider initial="en">
      <ProjectionText text="First reading" fontSize={20} clock={clock} durationMs={10000} continuousGroup={continuousGroup} onMetrics={value => { first = value }} />
      <ProjectionText text="Second reading" fontSize={20} clock={clock} durationMs={10000} continuousGroup={continuousGroup} onMetrics={value => { second = value }} />
    </I18nProvider>)
    await measure(0, 1000)
    await measure(1, 600)
    await tick(500)
    expect(first.progress).toBe(0)
    expect(second.progress).toBe(0)
    await tick(4500)
    expect(first.progress).toBeCloseTo(0.5, 1)
    expect(second.progress).toBeCloseTo(first.progress, 5)
    await measure(0, 1400)
    expect(first.maximum).toBe(1200)
    await tick(20) // Shared geometry updates are coalesced onto the next frame.
    expect(first.progress).toBeCloseTo(second.progress, 5)
    await tick(4500)
    expect(first.progress).toBe(1)
    expect(second.progress).toBe(1)
  })

  it('updates group geometry without removing the member until unmount', async () => {
    const clock = createProjectionClock(), continuousGroup = createContinuousGroup()
    const remove = jest.spyOn(continuousGroup, 'remove'), setGeometry = jest.spyOn(continuousGroup, 'setGeometry')
    const view = await render(<I18nProvider initial="en"><ProjectionText text="Reading" fontSize={20} clock={clock} durationMs={10000} continuousGroup={continuousGroup} /></I18nProvider>)
    await measure(0, 1000)
    await measure(0, 1400, 300)
    expect(setGeometry.mock.calls.at(-1)?.slice(1)).toEqual([1400, 300])
    expect(remove).not.toHaveBeenCalled()
    await view.unmount()
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('preserves the linked phase on duration correction and does not retain it after unlinking', async () => {
    const clock = createProjectionClock(), continuousGroup = createContinuousGroup()
    clock.setRunning(true)
    let first: ScrollMetrics = { maximum: 0, viewport: 0, progress: 0 }, second = first
    const content = (durationMs: number, linked = true) => <I18nProvider initial="en">
      <ProjectionText text="First reading" fontSize={20} clock={clock} durationMs={durationMs} continuousGroup={linked ? continuousGroup : undefined} onMetrics={value => { first = value }} />
      <ProjectionText text="Second reading" fontSize={20} clock={clock} durationMs={durationMs} continuousGroup={linked ? continuousGroup : undefined} onMetrics={value => { second = value }} />
    </I18nProvider>
    const view = await render(content(10000))
    await measure(0, 1000)
    await measure(1, 600)
    await tick(3000)
    const previous = first.progress
    await view.rerender(content(20000))
    expect(first.progress).toBeCloseTo(previous, 2)
    expect(second.progress).toBeCloseTo(first.progress, 5)
    await tick(1000)
    expect(first.progress).toBeGreaterThan(previous)
    expect(first.progress).toBeLessThan(0.5)
    await view.rerender(content(20000, false))
    expect(first.progress).toBeCloseTo(projectionPosition({ content: 1000, viewport: 200, lineHeight: 29, duration: 20000, reducedMotion: false }, clock.elapsed()).y / 800)
    expect(second.progress).toBeCloseTo(projectionPosition({ content: 600, viewport: 200, lineHeight: 29, duration: 20000, reducedMotion: false }, clock.elapsed()).y / 400)
  })

  it('excludes an overflowing missing-text placeholder from metrics and linked page counts', async () => {
    const clock = createProjectionClock(), pageGroup = createPageGroup()
    clock.setRunning(true)
    let missing: ScrollMetrics = { maximum: 0, viewport: 0, progress: 0 }, reading = missing
    await render(<I18nProvider initial="en">
      <ProjectionText text={null} fontSize={20} clock={clock} durationMs={10000} movement="paged" pageGroup={pageGroup} onMetrics={value => { missing = value }} />
      <ProjectionText text="Reading" fontSize={20} clock={clock} durationMs={10000} movement="paged" pageGroup={pageGroup} onMetrics={value => { reading = value }} />
    </I18nProvider>)
    await measure(0, 2000)
    await measure(1, 600)
    expect(missing.maximum).toBe(0)
    await tick(2100) // Four real pages, not fourteen placeholder pages: still on the opening page.
    expect(reading.progress).toBe(0)
    await tick(500)
    expect(reading.progress).toBeCloseTo(1 / 3)
    expect(missing.progress).toBe(0)
  })
})

async function display(patch: Partial<DisplayPreferences> = {}, missingTranslation = false) {
  const server = fakeServer()
  server.addService({ id: 7, church: 'Church', title: 'Service', status: 'active' }, [
    { id: 10, liturgyPartId: 100, position: 1, en: 'English reading', translit: missingTranslation ? undefined : 'Transliterated reading' },
  ], 100)
  await render(<I18nProvider initial="en"><PreferencesProvider>
    <DisplayScreen endpoints={endpoints} id={7} onBack={() => {}} transport={server.transport}
      config={{ ...TV_DISPLAY_DEFAULTS, ...patch }} />
  </PreferencesProvider></I18nProvider>)
  await act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); server.connected(7) })
  return server
}
const manualOffsets = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.filter(call => (call[0] as { animated?: boolean })?.animated).slice(-2).map(call => (call[0] as { y: number }).y)

describe('TV first remote scroll starts from the rendered fraction', () => {
  it('ignores missing-text placeholder overflow when choosing the remote page step', async () => {
    const spy = jest.spyOn(ScrollView.prototype, 'scrollTo')
    await display({}, true)
    await measure(0, 2000)
    await measure(1, 600)
    await remote('down')
    expect(manualOffsets(spy)).toEqual([0, 160])
  })

  it('starts Down at zero during the opening hold rather than elapsed / duration', async () => {
    const spy = jest.spyOn(ScrollView.prototype, 'scrollTo')
    await display()
    await measure(0, 1000)
    await measure(1, 600)
    await tick(150) // The short fixture uses the 3000ms minimum duration.
    await remote('down')
    expect(manualOffsets(spy)).toEqual([160, 80])
    await remote('up')
    expect(manualOffsets(spy)).toEqual([0, 0])
  })

  it.each(['paged', 'continuous'] as const)('starts Up from the displayed page in %s reduced-motion mode', async movement => {
    const spy = jest.spyOn(ScrollView.prototype, 'scrollTo')
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true)
    await display({ text_movement: movement })
    await measure(0, 1000)
    await measure(1, 600)
    await tick(1200) // Nine linked pages, 40% through the 3000ms fixture: displayed fraction is 3/8.
    await remote('up')
    expect(manualOffsets(spy)[0]).toBeCloseTo((3 / 8 - 0.2) * 800)
    expect(manualOffsets(spy)[1]).toBeCloseTo((3 / 8 - 0.2) * 400)
  })

  it('preserves each independent column\'s own rendered offset on the first Down', async () => {
    const spy = jest.spyOn(ScrollView.prototype, 'scrollTo')
    await display({ language_sync: 'independent' })
    await measure(0, 1000)
    await measure(1, 600)
    await tick(1200)
    await remote('down')
    // Content*0.4 - half a viewport, plus a 160px remote page. A frame can trail by 16ms.
    expect(manualOffsets(spy)[0]).toBeGreaterThanOrEqual(454)
    expect(manualOffsets(spy)[0]).toBeLessThanOrEqual(460)
    expect(manualOffsets(spy)[1]).toBeGreaterThanOrEqual(296)
    expect(manualOffsets(spy)[1]).toBeLessThanOrEqual(300)
  })
})
