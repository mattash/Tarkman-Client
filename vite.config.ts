import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import tsconfigPaths from 'vite-tsconfig-paths'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from "path"

// Read version from package.json for Sentry release tracking
const pkg = require('./package.json') as { version: string }

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-dom/client'],
          'vendor-tanstack': ['@tanstack/react-query', '@tanstack/react-router'],
          'vendor-sentry': ['@sentry/react'],
        },
      },
    },
  },
  plugins: [
    TanStackRouterVite({
      routesDirectory: './app/routes',
      generatedRouteTree: './app/routeTree.gen.ts',
    }),
    react(),
    tsconfigPaths(),
    ...(process.env.NODE_ENV === 'production' &&
    process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT || 'tarkman-client',
            authToken: process.env.SENTRY_AUTH_TOKEN,
          }),
        ]
      : []),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
  },
})
