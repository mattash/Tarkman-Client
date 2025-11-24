import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.*',
        '**/*.setup.*',
        '**/routeTree.gen.ts',
        '**/__tests__/**',
        '**/types/**',
        'app/entry-client.tsx',
        'app/document.tsx',
      ],
      // Thresholds to aim for (currently disabled to view baseline coverage)
      // thresholds: {
      //   statements: 60,
      //   branches: 50,
      //   functions: 50,
      //   lines: 60,
      // },
    },
  },
}) 