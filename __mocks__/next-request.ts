import { NextRequest } from 'next/server'

interface NextURL extends URL {
  clone(): URL;
}

export function createMockNextRequest(url: string): NextRequest {
  const request = new Request(url)
  const urlInstance = new URL(url)
  
  // Create nextUrl with clone method
  const nextUrl: NextURL = Object.assign(urlInstance, {
    clone: function() {
      return new URL(this.href)
    }
  })
  
  return {
    ...request,
    nextUrl,
    cookies: {
      get: jest.fn(),
      getAll: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      has: jest.fn(),
      clear: jest.fn(),
    },
    page: {
      name: null,
      params: {},
    },
    ua: null,
    [Symbol.for('edge-runtime.inspect.custom')]: jest.fn(),
  } as unknown as NextRequest
} 