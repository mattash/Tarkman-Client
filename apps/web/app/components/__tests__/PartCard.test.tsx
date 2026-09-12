import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PartCard from '../PartCard'
import { createMockPart } from '../../__tests__/factories/mockPartFactory'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/part-detail">{children}</a>,
}))

describe('PartCard', () => {
  it('renders chosen language metadata and an explicit missing translation', () => {
    const { part } = createMockPart({
      en: 'Peace to all.',
      ru: null,
      grabar: 'Խաղաղութիւն ամենեցուն։',
    })

    render(
      <ul>
        <PartCard part={part} sessionId="trial" selectedLanguages={['en', 'ru', 'grabar']} />
      </ul>,
    )

    expect(screen.getByText('Peace to all.').closest('[lang]')).toHaveAttribute('lang', 'en')
    expect(screen.getByText('Խաղաղութիւն ամենեցուն։').closest('[lang]')).toHaveAttribute('lang', 'hy')
    expect(screen.getByText('Russian')).toHaveAttribute('lang', 'en')
    expect(screen.getByText('Russian is unavailable for this passage.')).toHaveAttribute('lang', 'en')
    expect(screen.getAllByText('Peace to all.')).toHaveLength(1)
  })
})
