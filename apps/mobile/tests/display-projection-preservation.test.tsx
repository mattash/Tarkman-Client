import { expect, it, jest } from '@jest/globals'
import { render } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { DisplayProjection } from '../features/displayLinks/DisplayProjection'
import { ProjectionText } from '../features/displayLinks/ProjectionText'
import { previewState } from '../features/displayLinks/DisplayPreview'
import { useReader } from '../features/live/useReader'
import { link } from './fixtures/displayLink'

jest.mock('../features/live/useReader')
jest.mock('../features/displayLinks/ProjectionText', () => ({ ProjectionText: jest.fn(() => null) }))
it('reflows accepted config through existing clock, manual position, page group and reader identity', async () => {
  const state = { ...previewState(true), following: false }
  jest.mocked(useReader).mockReturnValue({ state, saved: null, retry: jest.fn(), dispatch: jest.fn(), refreshAfterCommand: jest.fn() })
  const make = (config = link) => <ThemeProvider><DisplayProjection apiBase="https://api.test" cableBase="wss://api.test/cable" sessionId={1} config={config} /></ThemeProvider>
  const view = await render(make())
  const first = jest.mocked(ProjectionText).mock.calls[0][0]
  first.manualPosition?.set(0.45)
  await view.rerender(make({ ...link, font_scale: 130, margin_percent: 0, show_explanations: true }))
  const changed = jest.mocked(ProjectionText).mock.calls.at(-1)![0]
  expect(changed.fontSize / first.fontSize).toBeCloseTo(1.3)
  expect(changed.clock).toBe(first.clock)
  expect(changed.manualPosition).toBe(first.manualPosition); expect(changed.manualPosition?.get()).toBe(0.45)
  expect(changed.pageGroup).toBe(first.pageGroup)
  expect(jest.mocked(useReader).mock.calls.at(-1)?.slice(1)).toEqual([1, true])
  await view.rerender(make({ ...link, status_view: 'pages_only' }))
  await view.rerender(make({ ...link, mode: 'single', lang2: null, text_movement: 'manual' }))
  expect(jest.mocked(ProjectionText).mock.calls.at(-1)![0].clock).toBe(first.clock)
  expect(jest.mocked(ProjectionText).mock.calls.at(-1)![0].manualPosition?.get()).toBe(0.45)
})
