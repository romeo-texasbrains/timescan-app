import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/middleware' // Restore Supabase import

export async function middleware(request: NextRequest) {
  // --- Original Logic Restored ---
  const { supabase, response } = createClient(request)
  const { data: { session } } = await supabase.auth.getSession()
  console.log(`[Middleware] Session exists: ${!!session}`);
  const { pathname } = request.nextUrl
  const protectedRoutes = ['/', '/scan', '/history', '/mgmt', '/admin'] 
  const isProtectedRoute = protectedRoutes.some((route) => pathname === route || (route !== '/' && pathname.startsWith(route + '/')))
  console.log(`[Middleware] Pathname: ${pathname}, Is protected: ${isProtectedRoute}`);
  if (!session && isProtectedRoute) {
    console.log(`[Middleware] Redirecting unauthenticated user from ${pathname} to /login`);
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return Response.redirect(redirectUrl)
  }
  if (session && pathname === '/login') {
    console.log(`[Middleware] Redirecting authenticated user from /login to /`);
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/' 
    return Response.redirect(redirectUrl)
  }
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/api/') ||  
    pathname.includes('.') 
  ) {
    console.log(`[Middleware] Skipping middleware for asset/internal path: ${pathname}`);
    return response 
  }
  console.log(`[Middleware] Allowing request to proceed for path: ${pathname}`);
  return response
  // --- End Original Logic ---
}

// Keep original config
export const config = {
  runtime: 'experimental-edge',
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
