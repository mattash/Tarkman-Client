import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import * as Sentry from '@sentry/react'
import { routeTree } from './routeTree.gen'
import { LanguageProvider } from './contexts/LanguageContext'
import './styles.css'

// Initialize Sentry as early as possible
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string) || 'development',
  release: `tarkman-client@${import.meta.env.VITE_APP_VERSION || 'unknown'}`,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: import.meta.env.VITE_SENTRY_ENVIRONMENT === 'development' ? 0 : 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

// Create a new router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

// Register your router for maximum type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!
const root = createRoot(rootElement)

root.render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <p className="text-xl font-semibold text-red-400 mb-4">Something went wrong</p>
          <p className="text-sm text-gray-400 mb-4">{String(error)}</p>
          <button
            onClick={resetError}
            className="px-4 py-2 bg-primary text-white rounded hover:opacity-90"
          >
            Try again
          </button>
        </div>
      )}
    >
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>
) 
