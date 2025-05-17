import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock environment variables
vi.mock('../app/env', () => ({
  env: {
    VITE_API_URL: 'http://localhost:3000'
  }
})) 