import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import type { User } from '@/types/auth'

interface TestProvidersOptions {
  queryClient?: QueryClient
  initialAuth?: { user: User | null; token: string | null }
  initialLanguage?: string
  routerInitialEntries?: string[]
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export function TestProviders({
  children,
  queryClient,
  initialAuth,
  initialLanguage,
}: TestProvidersOptions & { children: ReactNode }) {
  const client = queryClient || createTestQueryClient()

  // Mock AuthProvider if initialAuth is provided
  const AuthWrapper = initialAuth
    ? ({ children }: { children: ReactNode }) => {
        // Simple mock provider for testing
        return <>{children}</>
      }
    : AuthProvider

  return (
    <QueryClientProvider client={client}>
      <AuthWrapper>
        <LanguageProvider>{children}</LanguageProvider>
      </AuthWrapper>
    </QueryClientProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options: TestProvidersOptions & Omit<RenderOptions, 'wrapper'> = {}
) {
  const {
    queryClient,
    initialAuth,
    initialLanguage,
    routerInitialEntries,
    ...renderOptions
  } = options

  const client = queryClient || createTestQueryClient()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TestProviders
        queryClient={client}
        initialAuth={initialAuth}
        initialLanguage={initialLanguage}
      >
        {children}
      </TestProviders>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient: client,
  }
}

// Re-export everything from testing library
export * from '@testing-library/react'
export { userEvent } from '@testing-library/user-event'
