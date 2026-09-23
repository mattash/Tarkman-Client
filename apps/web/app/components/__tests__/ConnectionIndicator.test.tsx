import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ConnectionIndicator } from '../ConnectionIndicator'

describe('ConnectionIndicator', () => {
  it('is absent while connected', () => {
    render(<ConnectionIndicator state="connected" />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('announces recovery unobtrusively', () => {
    render(<ConnectionIndicator state="recovering" />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Reconnecting…')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveClass('fixed', 'right-3', 'top-3')
  })

  it('announces a disconnected retry state', () => {
    render(<ConnectionIndicator state="disconnected" />)
    expect(screen.getByRole('status')).toHaveTextContent('Disconnected — retrying')
  })
})
