import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TagBadge } from '../TagBadge'

describe('TagBadge', () => {
  it('should render with the provided tag text', () => {
    render(<TagBadge tag="theology" />)
    expect(screen.getByText('theology')).toBeInTheDocument()
  })

  it('should apply blue colors for theology tags', () => {
    const { container } = render(<TagBadge tag="theology" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-blue-100')
    expect(badge.className).toContain('text-blue-800')
  })

  it('should apply purple colors for history tags', () => {
    const { container } = render(<TagBadge tag="history" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-purple-100')
    expect(badge.className).toContain('text-purple-800')
  })

  it('should apply green colors for practice tags', () => {
    const { container } = render(<TagBadge tag="practice" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-green-100')
    expect(badge.className).toContain('text-green-800')
  })

  it('should apply amber colors for ritual tags', () => {
    const { container } = render(<TagBadge tag="ritual" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-amber-100')
    expect(badge.className).toContain('text-amber-800')
  })

  it('should apply gray colors for unknown tags', () => {
    const { container} = render(<TagBadge tag="unknown" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-gray-100')
    expect(badge.className).toContain('text-gray-800')
  })

  it('should handle case-insensitive tag matching', () => {
    const { container } = render(<TagBadge tag="THEOLOGY" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-blue-100')
  })

  it('should apply outline variant styles', () => {
    const { container } = render(<TagBadge tag="theology" variant="outline" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('border')
    expect(badge.className).toContain('border-blue-500')
    expect(badge.className).toContain('text-blue-700')
  })

  it('should apply default variant styles when variant is not specified', () => {
    const { container } = render(<TagBadge tag="theology" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).not.toContain('border')
  })

  it('should handle partial tag name matches (theological)', () => {
    const { container } = render(<TagBadge tag="theological" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-blue-100')
  })

  it('should handle partial tag name matches (historical)', () => {
    const { container } = render(<TagBadge tag="historical" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-purple-100')
  })

  it('should handle partial tag name matches (practical)', () => {
    const { container } = render(<TagBadge tag="practical" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-green-100')
  })
})
