import { beforeEach, expect, it, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react-native'
import { ThemeProvider } from '../design/ThemeProvider'
import SessionReaderScreen from '../app/sessions/[id]/parts'

let mockId = '9'
const mockReader = jest.fn<(props: unknown) => null>(() => null)
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mockId }),
  router: { canGoBack: () => false, replace: jest.fn(), back: jest.fn() },
}))
jest.mock('../features/live/config', () => ({ readerConfig: () => ({ endpoints: { api: 'https://api.test' } }) }))
jest.mock('../features/live/SessionReader', () => ({ SessionReader: (props: unknown) => mockReader(props) }))
jest.mock('../features/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

beforeEach(() => { mockReader.mockClear() })

it.each(['9007199254740993', '9007199254740992', '0', '-1', 'invalid'])('does not mount the reader for invalid ID %s', async id => {
  mockId = id
  await render(<ThemeProvider scheme="light"><SessionReaderScreen /></ThemeProvider>)
  expect(screen.getByText('common.serviceLinkInvalid')).toBeOnTheScreen()
  expect(mockReader).not.toHaveBeenCalled()
})

it('mounts the reader for a supported integer ID', async () => {
  mockId = '9'
  await render(<ThemeProvider scheme="light"><SessionReaderScreen /></ThemeProvider>)
  expect(mockReader).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }))
})
