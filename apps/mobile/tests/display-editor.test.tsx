import { expect, it, jest } from '@jest/globals'
import { usePreventRemove } from 'expo-router/react-navigation'
import { useEffect, useSyncExternalStore } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import { LinkEditor } from '../features/displayLinks/LinkEditor'
import { LinkList } from '../features/displayLinks/LinkList'
import { createManagementController } from '../features/displayLinks/managementController'
import { ManagementError, type createManagementApi } from '../features/displayLinks/managementApi'
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

// Public church discovery (#232). The backend reports `published`; an older one does not.
function setupListing(published: boolean | undefined) {
  const listed = published === undefined ? { ...link } : { ...link, published, published_at: published ? '2026-09-29T20:00:00.000Z' : null }
  const api = { revoke: jest.fn<ReturnType<typeof createManagementApi>['revoke']>().mockResolvedValue(undefined), list: jest.fn<ReturnType<typeof createManagementApi>['list']>().mockResolvedValue([listed]),
    save: jest.fn<ReturnType<typeof createManagementApi>['save']>().mockResolvedValue({ ...listed, published: true, published_at: '2026-09-29T20:05:00.000Z' }) }
  const controller = createManagementController(api, link.token)
  function Harness() {
    useEffect(() => controller.start(), [])
    const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
    return <ThemeProvider><LinkEditor controller={controller} state={state} /></ThemeProvider>
  }
  return { api, controller, Harness }
}
it('hides the public-discovery toggle on an older backend that omits published', async () => {
  const { Harness } = setupListing(undefined)
  await render(<Harness />)
  await fireEvent.press(screen.getByRole('tab', { name: '3. Advanced options' }))
  expect(screen.queryByLabelText('List in public church discovery')).toBeNull()
})
it('shows the toggle with the public-token warning, and saves only the publication change', async () => {
  const { Harness, api } = setupListing(false)
  await render(<Harness />)
  await fireEvent.press(screen.getByRole('tab', { name: '3. Advanced options' }))
  const toggle = screen.getByLabelText('List in public church discovery')
  expect(toggle.props.value).toBe(false)
  expect(screen.getByText(/makes the link’s token public/)).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled() // nothing changed yet
  await fireEvent(toggle, 'valueChange', true)
  expect(screen.getByLabelText('List in public church discovery').props.value).toBe(true)
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }))
  await act(flush)
  expect(api.save).toHaveBeenCalledTimes(1)
  expect(api.save.mock.calls[0][0]).toEqual({}) // no configuration field is sent
  expect(api.save.mock.calls[0][3]).toBe(true)
  expect(screen.getByText('Saved. Open displays will update automatically.')).toBeOnTheScreen()
  expect(screen.getByLabelText('List in public church discovery').props.value).toBe(true) // adopted from the response
})
it('shows a 422 on published next to the toggle and keeps the choice for a retry', async () => {
  const { Harness, api } = setupListing(false)
  api.save.mockRejectedValueOnce(new ManagementError(422, { published: 'requires the owner to have a church name on their profile' }))
  await render(<Harness />)
  await fireEvent.press(screen.getByRole('tab', { name: '3. Advanced options' }))
  await fireEvent(screen.getByLabelText('List in public church discovery'), 'valueChange', true)
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }))
  await act(flush)
  expect(screen.getAllByText(/requires the owner to have a church name on their profile/).length).toBeGreaterThan(0)
  expect(screen.getByLabelText('List in public church discovery').props.value).toBe(true)
})
it('shows each link’s public listing state in the list, and nothing for a link from an older backend', async () => {
  const links = [
    { ...link, token: 'on', title: 'Listed', published: true, published_at: '2026-09-29T20:00:00.000Z' },
    { ...link, token: 'off', title: 'Unlisted', published: false, published_at: null },
    { ...link, token: 'old', title: 'Legacy' },
  ]
  const api = { revoke: jest.fn<ReturnType<typeof createManagementApi>['revoke']>(), list: jest.fn<ReturnType<typeof createManagementApi>['list']>().mockResolvedValue(links),
    save: jest.fn<ReturnType<typeof createManagementApi>['save']>() }
  const controller = createManagementController(api)
  function Harness() {
    useEffect(() => controller.start(), [])
    const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
    return <ThemeProvider><LinkList controller={controller} state={state} /></ThemeProvider>
  }
  await render(<Harness />)
  await act(flush)
  expect(screen.getAllByText('Public listing: On')).toHaveLength(1)
  expect(screen.getAllByText('Public listing: Off')).toHaveLength(1)
  expect(screen.getByText('Legacy')).toBeOnTheScreen()
})
