import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../LoginForm'
import { AuthProvider } from '@/contexts/AuthContext'

// Mock the auth API
vi.mock('@/api/auth', () => ({
  login: vi.fn(),
}))

// Mock TanStack Router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

import { login } from '@/api/auth'

const getSubmitButton = () =>
  screen.getByRole('button', { name: /sign in to your account/i })

const renderLoginForm = () => {
  return render(
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  )
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render email and password inputs', () => {
    renderLoginForm()

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('should render login button', () => {
    renderLoginForm()

    expect(getSubmitButton()).toBeInTheDocument()
  })

  it('should update email input value when user types', async () => {
    const user = userEvent.setup()
    renderLoginForm()

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement

    await user.type(emailInput, 'test@example.com')

    expect(emailInput.value).toBe('test@example.com')
  })

  it('should update password input value when user types', async () => {
    const user = userEvent.setup()
    renderLoginForm()

    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement

    await user.type(passwordInput, 'password123')

    expect(passwordInput.value).toBe('password123')
  })

  it('should call login API and navigate on successful login', async () => {
    const user = userEvent.setup()
    const mockResponse = {
      user: { id: 1, email: 'test@example.com', name: 'Test User', roles: [] },
      token: 'test-token-123',
    }

    vi.mocked(login).mockResolvedValueOnce(mockResponse)

    renderLoginForm()

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = getSubmitButton()

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/' })
    })
  })

  it('should display error message on login failure', async () => {
    const user = userEvent.setup()
    const errorMessage = 'Invalid credentials'

    vi.mocked(login).mockRejectedValueOnce(new Error(errorMessage))

    renderLoginForm()

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = getSubmitButton()

    await user.type(emailInput, 'wrong@example.com')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('should clear error message on subsequent submit', async () => {
    const user = userEvent.setup()

    // First attempt fails
    vi.mocked(login).mockRejectedValueOnce(new Error('Invalid credentials'))

    renderLoginForm()

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = getSubmitButton()

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'wrongpassword')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })

    // Second attempt succeeds
    vi.mocked(login).mockResolvedValueOnce({
      user: { id: 1, email: 'test@example.com', name: 'Test User', roles: [] },
      token: 'test-token',
    })

    await user.clear(passwordInput)
    await user.type(passwordInput, 'correctpassword')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument()
    })
  })

  it('should handle non-Error exceptions', async () => {
    const user = userEvent.setup()

    vi.mocked(login).mockRejectedValueOnce('String error')

    renderLoginForm()

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = getSubmitButton()

    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument()
    })
  })

  it('should have email input type as "email"', () => {
    renderLoginForm()

    const emailInput = screen.getByLabelText(/email/i)
    expect(emailInput).toHaveAttribute('type', 'email')
  })

  it('should have password input type as "password"', () => {
    renderLoginForm()

    const passwordInput = screen.getByLabelText(/password/i)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('should have required attribute on email and password inputs', () => {
    renderLoginForm()

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)

    expect(emailInput).toBeRequired()
    expect(passwordInput).toBeRequired()
  })
})
