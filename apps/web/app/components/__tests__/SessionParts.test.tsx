import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'
import type { ReactNode } from 'react'
import { SessionParts } from '../SessionParts'
import { LanguageProvider, useLanguage } from '../../contexts/LanguageContext'
import { fetchSession, fetchSessionParts } from '../../queries/sessions'
import { useActionCable } from '../../hooks/useActionCable'
import { createMockPart } from '../../__tests__/factories/mockPartFactory'

vi.mock('../../queries/sessions', () => ({
  fetchSession: vi.fn(),
  fetchSessionParts: vi.fn(),
  sessionsKeys: {
    sessionParts: (id: string) => ['sessions', 'session', id, 'parts'] as const,
    session: (id: string) => ['sessions', 'session', id] as const,
  },
}))

vi.mock('../../hooks/useActionCable', () => ({
  useActionCable: vi.fn(() => null),
}))

vi.mock('../PartCard', async () => {
  const ReactModule = await import('react')
  return {
    default: ReactModule.forwardRef<HTMLLIElement, { part: { en: string }, selectedLanguages: string[] }>(
      ({ part, selectedLanguages }, ref) => (
        <li ref={ref}>{part.en}<span data-testid="rendered-languages">{selectedLanguages.join(',')}</span></li>
      ),
    ),
  }
})

const { handlePartUpdated } = vi.hoisted(() => ({ handlePartUpdated: vi.fn() }))

vi.mock('../../hooks/usePartScroll', () => ({
  usePartScroll: vi.fn(() => ({ partsRef: { current: {} }, handlePartUpdated })),
}))

const sessionData = {
  sessionData: {
    session: {
      id: 1,
      liturgy: 'Divine Liturgy',
      liturgy_id: 1,
      date: '2024-01-01',
      church_name: 'St. John',
      church_avatar: null,
      occupied: true,
      num_of_parts: 2,
      current_part_position: 1,
      current_part_id: null,
      current_liturgy_id: 1,
      page: 1,
      posture: null,
      readings: { gospel: '', epistle: '' },
      options: {},
    },
  },
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>{children}</LanguageProvider>
    </QueryClientProvider>
  )
}

describe('SessionParts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useActionCable).mockReturnValue(null)
  })

  it('keeps applied languages across a reader remount and aligns legacy detail language', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchSession).mockResolvedValue(sessionData.sessionData as never)
    vi.mocked(fetchSessionParts).mockResolvedValue({
      ...sessionData,
      sessionData: {
        ...sessionData.sessionData,
        session: { ...sessionData.sessionData.session, current_part_id: 1 },
      },
      parts: [createMockPart({ id: 1, en: 'Peace to all' })],
    } as never)

    function LanguageProbe() {
      const { selectedLang } = useLanguage()
      return <output aria-label="Legacy language">{selectedLang}</output>
    }

    function Harness() {
      const [showReader, setShowReader] = React.useState(true)
      return (
        <>
          <button type="button" onClick={() => setShowReader((visible) => !visible)}>Toggle reader</button>
          {showReader ? <SessionParts sessionId="1" /> : null}
          <LanguageProbe />
        </>
      )
    }

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <LanguageProvider><Harness /></LanguageProvider>
      </QueryClientProvider>,
    )

    await screen.findByText('Peace to all')
    expect(handlePartUpdated).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /languages/i }))
    await user.click(screen.getByRole('checkbox', { name: 'English' }))
    await user.click(screen.getByRole('checkbox', { name: 'Русский' }))
    await user.click(screen.getByRole('button', { name: 'Apply languages' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Reading appearance' }), 'dark')

    expect(screen.getByLabelText('Legacy language')).toHaveTextContent('ru')
    expect(screen.getByTestId('rendered-languages')).toHaveTextContent('ru')
    expect(handlePartUpdated).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Toggle reader' }))
    await user.click(screen.getByRole('button', { name: 'Toggle reader' }))
    await screen.findByText('Peace to all')
    expect(screen.getByTestId('rendered-languages')).toHaveTextContent('ru')
  })

  it('renders a liturgy that repeats the same part without duplicate React keys', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(fetchSession).mockResolvedValue(sessionData.sessionData as never)
    vi.mocked(fetchSessionParts).mockResolvedValue({
      ...sessionData,
      parts: [
        createMockPart({ id: 1, liturgy_part_id: 1, en: 'Our Father, who art in heaven' }),
        createMockPart({ id: 1, liturgy_part_id: 2, en: 'Our Father, who art in heaven' }),
      ],
    } as never)

    render(<SessionParts sessionId="1" />, { wrapper: makeWrapper() })

    const matches = await screen.findAllByText(/Our Father/)
    expect(matches.length).toBeGreaterThanOrEqual(2)
    const keyWarnings = consoleSpy.mock.calls.filter((args) =>
      args.some((arg) => typeof arg === 'string' && arg.includes('same key')),
    )
    expect(keyWarnings).toEqual([])

    consoleSpy.mockRestore()
  })
})
