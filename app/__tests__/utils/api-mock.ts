import { vi } from 'vitest'
import type { AxiosResponse } from 'axios'

export function createMockAxiosResponse<T>(data: T, status: number = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config: {
      headers: {} as any,
    },
  }
}

export function mockApiSuccess<T>(data: T, status: number = 200) {
  return vi.fn().mockResolvedValue(createMockAxiosResponse(data, status))
}

export function mockApiError(status: number = 500, message: string = 'Network Error') {
  const error: any = new Error(message)
  error.response = {
    status,
    statusText: message,
    data: { error: message },
    headers: {},
    config: { headers: {} as any },
  }
  return vi.fn().mockRejectedValue(error)
}

export function mock401Error() {
  return mockApiError(401, 'Unauthorized')
}

export function mockNetworkError() {
  const error: any = new Error('Network Error')
  error.code = 'ERR_NETWORK'
  return vi.fn().mockRejectedValue(error)
}

export function setupApiMocks() {
  const mocks = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  }

  return mocks
}

export function createMockFetchResponse<T>(
  data: T,
  options: { ok?: boolean; status?: number; statusText?: string } = {}
): Response {
  const { ok = true, status = 200, statusText = 'OK' } = options

  return {
    ok,
    status,
    statusText,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => createMockFetchResponse(data, options),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
  } as Response
}

export function mockFetchSuccess<T>(data: T, status: number = 200) {
  return vi.fn().mockResolvedValue(createMockFetchResponse(data, { status, ok: true }))
}

export function mockFetchError(status: number = 500, message: string = 'Error') {
  return vi.fn().mockResolvedValue(
    createMockFetchResponse({ error: message }, { status, ok: false, statusText: message })
  )
}
