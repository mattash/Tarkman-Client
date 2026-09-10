import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/contexts/AuthContext'
import { LanguageProvider } from '@/contexts/LanguageContext'

interface TestProvidersOptions {
  queryClient?: QueryClient
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
}: TestProvidersOptions & { children: ReactNode }) {
  const client = queryClient || createTestQueryClient()

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <LanguageProvider>{children}</LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options: TestProvidersOptions & Omit<RenderOptions, 'wrapper'> = {}
) {
  const { queryClient, ...renderOptions } = options

  const client = queryClient || createTestQueryClient()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TestProviders queryClient={client}>
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
