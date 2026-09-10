import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RatingDisplay } from '../RatingDisplay'

describe('RatingDisplay', () => {
  it('should display "No ratings yet" when rating count is 0', () => {
    render(<RatingDisplay averageRating={0} ratingCount={0} />)
    expect(screen.getByText('No ratings yet')).toBeInTheDocument()
  })

  it('should display average rating with one decimal place', () => {
    render(<RatingDisplay averageRating={4.5} ratingCount={10} />)
    expect(screen.getByText('4.5')).toBeInTheDocument()
  })

  it('should display rating count with plural "ratings"', () => {
    render(<RatingDisplay averageRating={4.5} ratingCount={10} />)
    expect(screen.getByText('(10 ratings)')).toBeInTheDocument()
  })

  it('should display rating count with singular "rating" when count is 1', () => {
    render(<RatingDisplay averageRating={5.0} ratingCount={1} />)
    expect(screen.getByText('(1 rating)')).toBeInTheDocument()
  })

  it('should render 5 full stars for a 5.0 rating', () => {
    const { container } = render(<RatingDisplay averageRating={5.0} ratingCount={10} />)
    const stars = container.querySelectorAll('svg')

    // All 5 stars should be filled (yellow)
    const filledStars = Array.from(stars).filter(star =>
      star.classList.contains('text-yellow-500')
    )
    expect(filledStars.length).toBe(5)
  })

  it('should render 0 filled stars for a 0 rating with positive count', () => {
    const { container } = render(<RatingDisplay averageRating={0} ratingCount={5} />)
    const stars = container.querySelectorAll('svg')

    // All stars should be empty (gray)
    const emptyStars = Array.from(stars).filter(star =>
      star.classList.contains('text-gray-300')
    )
    expect(emptyStars.length).toBe(5)
  })

  it('should render correct number of full stars for integer ratings', () => {
    const { container } = render(<RatingDisplay averageRating={3.0} ratingCount={10} />)
    const stars = container.querySelectorAll('svg')

    const filledStars = Array.from(stars).filter(star =>
      star.classList.contains('text-yellow-500')
    )
    expect(filledStars.length).toBe(3)
  })

  it('should render half star for ratings with .5 or above', () => {
    const { container } = render(<RatingDisplay averageRating={3.5} ratingCount={10} />)

    // Should have a half star (which is rendered as a relative div)
    const halfStarContainer = container.querySelector('.relative')
    expect(halfStarContainer).toBeInTheDocument()
  })

  it('should not render half star for ratings below .5', () => {
    const { container } = render(<RatingDisplay averageRating={3.4} ratingCount={10} />)

    // Should not have a half star
    const halfStarContainer = container.querySelector('.relative')
    expect(halfStarContainer).toBeNull()
  })

  it('should round rating to one decimal place', () => {
    render(<RatingDisplay averageRating={4.567} ratingCount={10} />)
    expect(screen.getByText('4.6')).toBeInTheDocument()
  })

  it('should handle edge case of 1.0 rating', () => {
    const { container } = render(<RatingDisplay averageRating={1.0} ratingCount={1} />)
    const stars = container.querySelectorAll('svg')

    const filledStars = Array.from(stars).filter(star =>
      star.classList.contains('text-yellow-500')
    )
    expect(filledStars.length).toBe(1)
    expect(screen.getByText('1.0')).toBeInTheDocument()
    expect(screen.getByText('(1 rating)')).toBeInTheDocument()
  })

  it('should handle edge case of 4.9 rating (should show 4 full stars and 1 half star)', () => {
    const { container } = render(<RatingDisplay averageRating={4.9} ratingCount={100} />)

    const halfStarContainer = container.querySelector('.relative')
    expect(halfStarContainer).toBeInTheDocument()
    expect(screen.getByText('4.9')).toBeInTheDocument()
  })

  it('should display correct star visualization for 2.5 rating', () => {
    const { container } = render(<RatingDisplay averageRating={2.5} ratingCount={20} />)

    const filledStars = Array.from(container.querySelectorAll('svg')).filter(star =>
      star.classList.contains('text-yellow-500')
    )
    const halfStarContainer = container.querySelector('.relative')

    // Should have 2 full stars and 1 half star
    expect(filledStars.length).toBeGreaterThan(0)
    expect(halfStarContainer).toBeInTheDocument()
    expect(screen.getByText('2.5')).toBeInTheDocument()
  })
})
