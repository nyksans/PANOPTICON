import { authMiddleware } from '@clerk/nextjs'
import { NextResponse } from 'next/server'

export default authMiddleware({
  // Allow these routes to be public
  publicRoutes: [
    '/',
    '/auth/signin',
    '/auth/signup',
    '/api/webhooks/(.*)',
  ],

  // Ignore these routes for Clerk authentication
  ignoredRoutes: [
    '/api/webhooks/(.*)',
    '/(.*).svg',
    '/(.*).png',
    '/(.*).jpg',
  ],

  // After auth, redirect unauthenticated users to signin
  afterAuth: (auth, req) => {
    // If user is signed in and trying to access auth pages, redirect to dashboard
    if (
      auth.userId &&
      (req.nextUrl.pathname === '/auth/signin' ||
        req.nextUrl.pathname === '/auth/signup')
    ) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // If user is not signed in and trying to access protected routes, redirect to signin
    if (
      !auth.userId &&
      !req.nextUrl.pathname.startsWith('/auth') &&
      req.nextUrl.pathname !== '/'
    ) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    // Allow the request to proceed
    return NextResponse.next()
  },
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
