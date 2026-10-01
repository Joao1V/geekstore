import { type NextRequest, NextResponse } from 'next/server';

const REDIRECT_PERMANENT = 308;
const HAS_FILE_EXTENSION = /\.\w+$/;

// `skipTrailingSlashRedirect` (next.config.ts) desliga o redirect de barra final do Next para que
// `/api/x?q=` chegue ao rewrite sem passar por um 308. Este proxy devolve o comportamento só para
// as PÁGINAS: sem ele, `/catalogo` e `/catalogo/` serviriam o mesmo conteúdo (URL duplicada, SEO).
// O `Location` é montado à mão porque `NextResponse.redirect` normaliza a barra final do destino.
export function proxy(request: NextRequest) {
  const { pathname, search, origin, basePath } = request.nextUrl;
  if (pathname.endsWith('/') || HAS_FILE_EXTENSION.test(pathname)) return NextResponse.next();
  return new NextResponse(null, {
    status: REDIRECT_PERMANENT,
    headers: { location: `${origin}${basePath}${pathname}/${search}` },
  });
}

export const config = {
  // Fora `/api` (vai direto ao rewrite) e `/_next`.
  matcher: ['/((?!api(?:/|$)|_next(?:/|$)).*)'],
};
