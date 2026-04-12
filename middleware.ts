import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

// Create the next-intl middleware
const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isStaticFile = pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|js|css|woff|woff2|ttf|eot|json|webmanifest)$/);
  const isApiRoute = pathname.startsWith('/api');
  const isNextInternal = pathname.startsWith('/_next');
  const isManifest = pathname === '/manifest.json' || pathname === '/sw.js';
  const isAuthCallback = pathname === '/auth/callback' || pathname.startsWith('/auth/callback');

  const isNextAction = request.headers.has('next-action');

  if (isStaticFile || isApiRoute || isNextInternal || isManifest || isAuthCallback || isNextAction) {
    return NextResponse.next();
  }

  const host = request.headers.get("host") || "";
  const adminDomain = "admin.viraweb.online";



  // Handle admin subdomain rewrite (internal)
  if (host.includes(adminDomain)) {
    const excludedPaths = ['/pt-BR/admin', '/en/admin', '/api', '/_next'];
    const shouldRewrite = !excludedPaths.some(p => pathname.startsWith(p));
    
    if (shouldRewrite) {
      const url = request.nextUrl.clone();
      const hasLocale = pathname.startsWith('/pt-BR') || pathname.startsWith('/en');
      if (hasLocale) {
        url.pathname = pathname.replace(/^\/(pt-BR|en)/, '/$1/admin');
      } else {
        url.pathname = `/pt-BR/admin${pathname === '/' ? '' : pathname}`;
      }
      return NextResponse.rewrite(url);
    }
  }

  // GDC subdomain: no special rewrite needed.
  // The landing page renders at / and free-trial is available at /free-trial.
  // Customer detection is handled client-side by the page components.

  // Handle manual redirects for common legacy paths
  if (pathname.includes('/auth') && !pathname.includes('/free-trial/auth') && !pathname.includes('/auth/callback')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace('/auth', '/free-trial/auth');
    return NextResponse.redirect(url);
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
  matcher: ['/((?!_next/static|_next/image|favicon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest)$).*)']
}
