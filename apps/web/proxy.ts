import { type NextRequest, NextResponse } from 'next/server';
import { robotsHeaderFor } from '@/lib/indexing';
import { findRedirect } from '@/lib/redirect-map';

const REDIRECT_PERMANENT = 308;
// Endereço antigo da Tray -> novo (RF-MIG-03): 301 de verdade, que é o que os buscadores transferem.
const REDIRECT_MOVED = 301;
const ADMIN_PREFIX = '/admin';
const HAS_FILE_EXTENSION = /\.\w+$/;

function withRobotsHeader(response: NextResponse, pathname: string): NextResponse {
  const robots = robotsHeaderFor(pathname);
  if (robots) response.headers.set('x-robots-tag', robots);
  return response;
}

// `skipTrailingSlashRedirect` (next.config.ts) desliga o redirect de barra final do Next para que
// `/api/x?q=` chegue ao rewrite sem passar por um 308. Este proxy devolve o comportamento só para
// as PÁGINAS: sem ele, `/catalogo` e `/catalogo/` serviriam o mesmo conteúdo (URL duplicada, SEO).
// O `Location` é montado à mão porque `NextResponse.redirect` normaliza a barra final do destino.
// Também aplica o `X-Robots-Tag` (lib/indexing.ts) a todas as respostas de página.
export async function proxy(request: NextRequest) {
  const { pathname, search, origin, basePath } = request.nextUrl;
  const isAdmin = pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
  if (!isAdmin && (request.method === 'GET' || request.method === 'HEAD')) {
    const target = await findRedirect(pathname);
    if (target) {
      const moved = new NextResponse(null, {
        status: REDIRECT_MOVED,
        headers: { location: `${origin}${basePath}${target}` },
      });
      return withRobotsHeader(moved, pathname);
    }
  }
  if (pathname.endsWith('/') || HAS_FILE_EXTENSION.test(pathname)) {
    return withRobotsHeader(NextResponse.next(), pathname);
  }
  const redirect = new NextResponse(null, {
    status: REDIRECT_PERMANENT,
    headers: { location: `${origin}${basePath}${pathname}/${search}` },
  });
  return withRobotsHeader(redirect, pathname);
}

export const config = {
  // Fora `/api` (vai direto ao rewrite) e `/_next`.
  matcher: ['/((?!api(?:/|$)|_next(?:/|$)).*)'],
};
