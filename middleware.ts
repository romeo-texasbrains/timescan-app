import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // The `createClient` function created earlier handles updating the Vercel Edge Runtime compatible response cookies.
  // It also returns the modified response so it can be returned from the middleware.
  const { supabase, response } = createClient(request)

  // Refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // Define protected routes (adjust regex or paths as needed)
  const protectedRoutes = ['/', '/scan', '/history', '/mgmt', '/admin'] // Add base path '/' if it should be protected

  // Check if the current path starts with any of the protected routes
  const isProtectedRoute = protectedRoutes.some((route) => pathname === route || (route !== '/' && pathname.startsWith(route + '/')))

  // Redirect to login if user is not authenticated and trying to access a protected route
  if (!session && isProtectedRoute) {
    // Save the intended destination for redirect after login
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    // Optional: add a query param to redirect back after login?
    // redirectUrl.searchParams.set('redirectedFrom', pathname)
    return Response.redirect(redirectUrl)
  }

  // If user is authenticated and tries to access login page, redirect them to home/dashboard
  if (session && pathname === '/login') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/' // Redirect to home page
    return Response.redirect(redirectUrl)
  }

  // IMPORTANT: Avoid running middleware logic on static assets, API routes, or internal Next.js paths
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/api/') ||  // Exclude API routes
    pathname.includes('.') // Generally includes files like favicon.ico, images, etc.
  ) {
    return response // Pass through without auth checks
  }

  // Return the response with updated cookies
  return response
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    // Include specific root paths if needed, e.g. '/', '/login'
    '/',
    '/login',
    '/scan',
    '/history',
    '/mgmt/:path*',
    '/admin/:path*',
  ],
}
