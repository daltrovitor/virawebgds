import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

// Create the next-intl middleware
const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files and API routes for i18n handling
  const isStaticFile = pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|js|css|woff|woff2|ttf|eot)$/);
  const isApiRoute = pathname.startsWith('/api');
  const isNextInternal = pathname.startsWith('/_next');

  if (isStaticFile || isApiRoute || isNextInternal) {
    return NextResponse.next();
  }

  try {
    // First, handle i18n routing
    const intlResponse = intlMiddleware(request);

    // If intl middleware redirected, return that response
    if (intlResponse.status !== 200) {
      // Still update Supabase session on redirects
      try {
        await updateSession(request);
      } catch (e) {
        console.error("[Middleware] Supabase session update failed:", e);
      }
      return intlResponse;
    }

    // Then, update Supabase session
    try {
      const supabaseResp = await updateSession(request);

      // Merge cookies from both responses
      const cookies = supabaseResp.cookies.getAll();
      cookies.forEach(cookie => {
        intlResponse.cookies.set(cookie.name, cookie.value, {
          ...cookie,
        });
      });
    } catch (err) {
      console.error("[Middleware] Supabase error:", err);
    }

    return intlResponse;
  } catch (err) {
    console.error("Middleware error:", err)
    return NextResponse.next()
  }
}

export const config = {
  // Match all pathnames except for static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)']
}
