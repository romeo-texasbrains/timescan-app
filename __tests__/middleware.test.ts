import { middleware } from '../middleware'
import { NextResponse } from 'next/server'
import { createMockNextRequest } from '../__mocks__/next-request'

// Mock Supabase middleware client
jest.mock('@/lib/supabase/middleware', () => ({
  createClient: jest.fn((req) => ({
    supabase: {
      auth: {
        getSession: jest.fn(),
      },
    },
    response: new Response(),
  })),
}))

describe('Middleware', () => {
  const mockCreateClient = jest.requireMock('@/lib/supabase/middleware').createClient

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('API Routes', () => {
    it('should pass through API requests without auth checks', async () => {
      const mockResponse = new Response()
      mockCreateClient.mockReturnValue({
        supabase: {
          auth: {
            getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
          },
        },
        response: mockResponse,
      })

      const request = createMockNextRequest('http://localhost:3000/api/attendance')
      const response = await middleware(request)
      expect(response).toBe(mockResponse)
    })
  })

  describe('Protected Routes', () => {
    it('should redirect unauthenticated users to login', async () => {
      mockCreateClient.mockReturnValue({
        supabase: {
          auth: {
            getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
          },
        },
        response: new Response(),
      })

      const request = createMockNextRequest('http://localhost:3000/scan')
      const response = await middleware(request)
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('http://localhost:3000/login')
    })

    it('should allow authenticated users to access protected routes', async () => {
      const mockResponse = new Response()
      mockCreateClient.mockReturnValue({
        supabase: {
          auth: {
            getSession: jest.fn().mockResolvedValue({ 
              data: { session: { user: { id: '123' } } }
            }),
          },
        },
        response: mockResponse,
      })

      const request = createMockNextRequest('http://localhost:3000/scan')
      const response = await middleware(request)
      expect(response).toBe(mockResponse)
    })
  })

  describe('Login Route', () => {
    it('should redirect authenticated users away from login page', async () => {
      mockCreateClient.mockReturnValue({
        supabase: {
          auth: {
            getSession: jest.fn().mockResolvedValue({ 
              data: { session: { user: { id: '123' } } }
            }),
          },
        },
        response: new Response(),
      })

      const request = createMockNextRequest('http://localhost:3000/login')
      const response = await middleware(request)
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('http://localhost:3000/')
    })
  })

  describe('Static Assets', () => {
    it('should pass through static asset requests', async () => {
      const mockResponse = new Response()
      mockCreateClient.mockReturnValue({
        supabase: {
          auth: {
            getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
          },
        },
        response: mockResponse,
      })

      const request = createMockNextRequest('http://localhost:3000/_next/static/file.js')
      const response = await middleware(request)
      expect(response).toBe(mockResponse)
    })
  })
}) 