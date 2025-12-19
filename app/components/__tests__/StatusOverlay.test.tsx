import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusOverlay } from '../StatusOverlay'

describe('StatusOverlay', () => {
  it('should not render for active status', () => {
    const { container } = render(<StatusOverlay status="active" />)
    expect(container.firstChild).toBeNull()
  })

  it('should render paused message with default text', () => {
    render(<StatusOverlay status="paused" />)
    expect(screen.getByText('Service Paused')).toBeInTheDocument()
  })

  it('should render paused message with custom text', () => {
    render(<StatusOverlay status="paused" statusMessage="Brief intermission" />)
    expect(screen.getByText('Brief intermission')).toBeInTheDocument()
  })

  it('should render gospel with title and session option', () => {
    render(
      <StatusOverlay
        status="showing_gospel"
        sessionOptions={{ gospel: 'John 3:16 - For God so loved the world...' }}
      />
    )
    expect(screen.getByText('Gospel')).toBeInTheDocument()
    expect(screen.getByText('John 3:16 - For God so loved the world...')).toBeInTheDocument()
  })

  it('should render gospel with fallback text when option missing', () => {
    render(<StatusOverlay status="showing_gospel" />)
    expect(screen.getByText('Gospel')).toBeInTheDocument()
    expect(screen.getByText('Gospel Reading')).toBeInTheDocument()
  })

  it('should render epistle with title and session option', () => {
    render(
      <StatusOverlay
        status="showing_epistle"
        sessionOptions={{ epistle: 'Romans 8:28 - All things work together for good...' }}
      />
    )
    expect(screen.getByText('Epistle')).toBeInTheDocument()
    expect(screen.getByText('Romans 8:28 - All things work together for good...')).toBeInTheDocument()
  })

  it('should render epistle with fallback text when option missing', () => {
    render(<StatusOverlay status="showing_epistle" />)
    expect(screen.getByText('Epistle')).toBeInTheDocument()
    expect(screen.getByText('Epistle Reading')).toBeInTheDocument()
  })

  it('should render welcome with title and session option', () => {
    render(
      <StatusOverlay
        status="showing_welcome"
        sessionOptions={{ before_message: 'Welcome to our service!' }}
      />
    )
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText('Welcome to our service!')).toBeInTheDocument()
  })

  it('should render welcome with fallback text when option missing', () => {
    render(<StatusOverlay status="showing_welcome" />)
    const welcomeElements = screen.getAllByText('Welcome')
    expect(welcomeElements).toHaveLength(2) // Title and message both show "Welcome"
  })

  it('should render custom announcement with title and message', () => {
    render(
      <StatusOverlay
        status="showing_custom"
        statusMessage="Special announcement: Service will be delayed by 10 minutes"
      />
    )
    expect(screen.getByText('Announcement')).toBeInTheDocument()
    expect(screen.getByText('Special announcement: Service will be delayed by 10 minutes')).toBeInTheDocument()
  })

  it('should render custom announcement with fallback text when message missing', () => {
    render(<StatusOverlay status="showing_custom" />)
    const announcementElements = screen.getAllByText('Announcement')
    expect(announcementElements).toHaveLength(2) // Title and message both show "Announcement"
  })

  it('should have aria-live attribute for accessibility', () => {
    const { container } = render(<StatusOverlay status="paused" />)
    const overlay = container.querySelector('[aria-live="polite"]')
    expect(overlay).toBeInTheDocument()
  })

  it('should handle multiline text with whitespace-pre-wrap', () => {
    const multilineMessage = 'Line 1\nLine 2\nLine 3'
    const { container } = render(<StatusOverlay status="showing_custom" statusMessage={multilineMessage} />)
    const messageDiv = container.querySelector('.whitespace-pre-wrap')
    expect(messageDiv).toHaveTextContent('Line 1')
    expect(messageDiv).toHaveTextContent('Line 2')
    expect(messageDiv).toHaveTextContent('Line 3')
  })
})
