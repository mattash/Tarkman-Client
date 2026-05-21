import '@testing-library/jest-dom'
import { vi } from 'vitest'

const createStorageMock = () => {
  let store: Record<string, string> = {}

  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length
    },
  }
}

const localStorageMock = createStorageMock()
const sessionStorageMock = createStorageMock()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
})

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  })

  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true,
  })
}
