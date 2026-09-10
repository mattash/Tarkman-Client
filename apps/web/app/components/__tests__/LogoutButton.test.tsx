import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogoutButton } from '../LogoutButton'
import { logout } from '@/api/auth'

const logoutContext = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ logout: logoutContext }),
}))

vi.mock('@/api/auth', () => ({
  logout: vi.fn(),
}))

describe('LogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('uses the latest stored token when signing out', async () => {
    localStorage.setItem('token', 'rotated-token')
    vi.mocked(logout).mockResolvedValueOnce()
    const user = userEvent.setup()

    render(<LogoutButton />)
    await user.click(screen.getByRole('button', { name: 'Sign Out' }))

    await waitFor(() => {
      expect(logout).toHaveBeenCalledWith('rotated-token')
      expect(logoutContext).toHaveBeenCalledOnce()
    })
  })

  it('clears local authentication when the server logout fails', async () => {
    localStorage.setItem('token', 'current-token')
    vi.mocked(logout).mockRejectedValueOnce(new Error('Network error'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    render(<LogoutButton />)
    await user.click(screen.getByRole('button', { name: 'Sign Out' }))

    await waitFor(() => {
      expect(logoutContext).toHaveBeenCalledOnce()
    })
    consoleError.mockRestore()
  })

  it('clears local authentication without a server request when no token exists', async () => {
    const user = userEvent.setup()

    render(<LogoutButton />)
    await user.click(screen.getByRole('button', { name: 'Sign Out' }))

    expect(logout).not.toHaveBeenCalled()
    expect(logoutContext).toHaveBeenCalledOnce()
  })
})
