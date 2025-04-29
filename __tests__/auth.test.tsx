import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../app/(auth)/login/page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}))

// Mock Supabase client
const mockSignInWithPassword = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
    },
  }),
}))

describe('LoginPage', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks()
  })

  it('should render login form', () => {
    render(<LoginPage />)
    
    expect(screen.getByRole('heading', { name: /login to timescan/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('should show loading state during form submission', async () => {
    mockSignInWithPassword.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    render(<LoginPage />)
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    
    const submitButton = screen.getByRole('button', { name: /sign in/i })
    await user.click(submitButton)
    
    expect(submitButton).toBeDisabled()
    expect(screen.getByText(/signing in/i)).toBeInTheDocument()
    expect(submitButton).toHaveClass('bg-indigo-400')
  })

  it('should handle unexpected error', async () => {
    const errorMessage = 'Network error'
    mockSignInWithPassword.mockRejectedValueOnce(new Error(errorMessage))
    
    render(<LoginPage />)
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument()
    })
    
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
  })

  it('should handle Supabase auth error', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ 
      error: { message: 'Invalid login credentials' }
    })
    
    render(<LoginPage />)
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/login failed: invalid login credentials/i)).toBeInTheDocument()
    })
    
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
  })

  it('should handle successful login', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: null })
    
    render(<LoginPage />)
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    await user.type(screen.getByLabelText(/password/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/login successful/i)).toBeInTheDocument()
    })
  })
}) 