import { jest } from '@jest/globals'
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock'

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext)
// FlashList measurement stand-in; see README.md#flashlist-jest-measurement-stand-in.
jest.mock('@shopify/flash-list/dist/recyclerview/utils/measureLayout', () => ({
  ...jest.requireActual<object>('@shopify/flash-list/dist/recyclerview/utils/measureLayout'),
  measureParentSize: jest.fn(() => ({ x: 0, y: 0, width: 402, height: 2000 })),
  measureFirstChildLayout: jest.fn(() => ({ x: 0, y: 0, width: 402, height: 2000 })),
  measureItemLayout: jest.fn(() => ({ x: 0, y: 0, width: 402, height: 100 })),
}))
