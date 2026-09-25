import { expect, it, jest } from '@jest/globals'
import { usePreventRemove } from 'expo-router/react-navigation'
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
  const api = { revoke: jest.fn<ReturnType<typeof createManagementApi>['revoke']>().mockResolvedValue(undefined), list: jest.fn<ReturnType<typeof createManagementApi>['list']>().mockResolvedValue([{ ...link, lang1: 'hyw' }]),
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
  await fireEvent.press(screen.getByRole('button', { name: 'Display device: Automatic' }))
  expect(screen.queryByRole('button', { name: /Western Armenian/ })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Projector' }))
  expect(screen.getByRole('button', { name: 'Display device: Projector' })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Increase text size' }))
  expect(screen.getByText('Text size: 105%')).toBeOnTheScreen()
  expect(api.save).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }))
  expect(screen.getByText('Preview — not a live service')).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Create display link' }))
  await act(flush)
  expect(api.save.mock.calls[0][0]).toMatchObject({ device_type: 'projector', font_scale: 105, show_explanations: false, margin_percent: null, expires_at: null })
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
  expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(true)
})

it('confirms destructive revocation, supports cancel, and removes sharing after success', async () => {
  const { Harness, api } = setup(link.token)
  await render(<Harness />)
  await fireEvent.press(screen.getByRole('button', { name: 'Revoke link' }))
  expect(api.revoke).not.toHaveBeenCalled()
  expect(screen.getByText(/Permanently delete this display link/)).toBeOnTheScreen()
  await fireEvent.press(screen.getAllByRole('button', { name: 'Cancel' }).at(-1)!)
  expect(api.revoke).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Revoke link' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Revoke permanently' }))
  await act(flush)
  expect(api.revoke).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Display link revoked. It can no longer be used.')).toBeOnTheScreen()
  expect(screen.queryByLabelText('Share Sanctuary')).toBeNull()
})
it('retains invalid expiration text after validation and clears its stale summary on edit', async () => {
  const { Harness, api } = setup(null)
  await render(<Harness />)
  await fireEvent.press(screen.getByRole('tab', { name: '3. Advanced options' }))
  await fireEvent.changeText(screen.getByLabelText('Expiration (optional)'), 'bad date')
  await fireEvent.press(screen.getByRole('button', { name: 'Create display link' }))
  expect(screen.getByDisplayValue('bad date')).toBeOnTheScreen()
  expect(api.save).not.toHaveBeenCalled()
  await fireEvent.changeText(screen.getByLabelText('Expiration (optional)'), '')
  expect(screen.queryByText('Check the highlighted fields. Your changes are still unsaved.')).toBeNull()
})
