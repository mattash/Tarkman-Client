import * as React from 'react'
import * as Sentry from '@sentry/react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AuthProvider } from '@/contexts/AuthContext'
import { Navbar } from '@/components/Navbar'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
})

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: ErrorComponent,
})

function ErrorComponent({ error }: { error: unknown }) {
  React.useEffect(() => {
    Sentry.captureException(error)
  }, [error])
  console.error('[Tarkman Error]', error)
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <p className="text-xl font-semibold text-red-400 mb-4">Something went wrong</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-primary text-white rounded hover:opacity-90"
      >
        Reload
      </button>
    </div>
  )
}

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="min-h-screen bg-gray-900">
          {!window.location.pathname.includes('display') && <Navbar />}
          <main className="container mx-auto p-4 bg-gray-900 text-gray-100">
            <Outlet />
          </main>
        </div>
        <ReactQueryDevtools initialIsOpen={false} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
