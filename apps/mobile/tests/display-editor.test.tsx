import { expect, it, jest } from '@jest/globals'
import { useEffect, useSyncExternalStore } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { LinkEditor } from '../features/displayLinks/LinkEditor'
import { createManagementController } from '../features/displayLinks/managementController'
import type { createManagementApi } from '../features/displayLinks/managementApi'
import { link, flush } from './fixtures/displayLink'

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
jest.mock('expo-router', () => ({ router: { replace: jest.fn() }, useNavigation: () => ({ dispatch: jest.fn() }) }))
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }))
jest.mock('../features/displayLinks/ProjectionText', () => ({ ProjectionText: () => null }))
function setup(token: string | null) {
  const api = { list: jest.fn<ReturnType<typeof createManagementApi>['list']>().mockResolvedValue([{ ...link, lang1: 'hyw' }]),
    save: jest.fn<ReturnType<typeof createManagementApi>['save']>().mockResolvedValue({ ...link, config_version: 2 }) }
  const controller = createManagementController(api, token)
  function Harness() {
    useEffect(() => controller.start(), [])
    const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
    return <ThemeProvider><LinkEditor controller={controller} state={state} /></ThemeProvider>
  }
  return { api, controller, Harness }
}
it('previews changes locally, saves explicitly, and never offers unsupported Western Armenian for new selection', async () => {
  const { api, Harness } = setup(null)
  await render(<Harness />)
  expect(screen.getByText('Preview — not a live service')).toBeOnTheScreen()
  await fireEvent.press(screen.getByText('Increase text size'))
  expect(screen.getByText('Text size: 105%')).toBeOnTheScreen()
  expect(api.save).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /Western Armenian/ })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Create display link', exact: true }))
  await act(flush)
  expect(api.save.mock.calls[0][0]).toMatchObject({ font_scale: 105, show_explanations: false, margin_percent: null, expires_at: null })
  expect(screen.getByText('Saved. Open displays will update automatically.')).toBeOnTheScreen()
  expect(screen.getByLabelText('Share Sanctuary')).toBeEnabled()
})
it('preserves stored hyw, disables sharing while dirty, and registers the unsaved guard', async () => {
  const { Harness, controller } = setup(link.token)
  await render(<Harness />)
  expect(screen.getByText(/This link uses Western Armenian/)).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText('Title (optional)'), 'New title')
  expect(controller.getSnapshot().draft.lang1).toBe('hyw')
  expect(screen.getByLabelText('Share Sanctuary')).toBeDisabled()
  const { usePreventRemove } = await import('expo-router/react-navigation')
  expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(true)
})
