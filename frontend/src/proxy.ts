import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicConfig } from '@/lib/supabase/config';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  try {
    const { url, key } = publicConfig();
    const client = createServerClient(url, key, { cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    } });
    const { data: { user } } = await client.auth.getUser();
    if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
      const target = new URL('/login', request.url); target.searchParams.set('next', request.nextUrl.pathname);
      const redirect = NextResponse.redirect(target);
      response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
      return redirect;
    }
  } catch {
    if (request.nextUrl.pathname.startsWith('/dashboard')) return NextResponse.redirect(new URL('/login?notice=configuration', request.url));
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/dashboard/:path*', '/login', '/register', '/auth/:path*', '/api/requests/:path*'] };
