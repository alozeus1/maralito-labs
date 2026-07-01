import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Public paths (no session required). Route groups don't appear in the URL, so we gate by path.
const PUBLIC_PREFIXES = ['/welcome', '/about', '/login', '/sign-up', '/auth', '/unauthorized', '/api/health'];
const isPublic = (p: string) => PUBLIC_PREFIXES.some((x) => p === x || p.startsWith(x + '/'));

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return res; // env not wired yet (Phase 1 sandbox) → pass through

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
      setAll: (cs) => cs.forEach((c) => res.cookies.set(c.name, c.value, c.options)),
    },
  });
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const path = req.nextUrl.pathname;

  // Logged-in users shouldn't sit on auth screens.
  if (user && (path === '/login' || path === '/sign-up')) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  // Unauthenticated users can't reach protected (customer/admin) paths.
  if (!user && !isPublic(path)) {
    const to = new URL('/login', req.url);
    to.searchParams.set('next', path);
    return NextResponse.redirect(to);
  }
  // Fine-grained role checks (admin vs customer) happen in server layouts (Node runtime + DB).
  return res;
}

export const config = {
  // Run on everything except Next internals + static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
