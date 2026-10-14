import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NextConfig } from 'next';

// URL da API vista pelo servidor do Next (rede interna). Nunca vai para o bundle do browser.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL;
const BASE_PATH = process.env.BASE_PATH || undefined;
// No build `admin` o Dockerfile apaga `app/(store)`: no domínio do painel só existem as rotas /admin.
// Detectado pelas pastas, porque o Turbo não repassa `APP_MODE` ao `next build`.
const IS_ADMIN_BUILD =
  existsSync(join(process.cwd(), 'app/(admin)')) && !existsSync(join(process.cwd(), 'app/(store)'));

const nextConfig: NextConfig = {
  output: 'standalone',
  trailingSlash: true,
  // O redirect de barra final do Next roda antes dos rewrites e pegaria `/api/x?q=` (308 para `/api/x/?q=`).
  // Desligado, quem redireciona as páginas é o `proxy.ts`; `/api/*` passa direto ao rewrite.
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
  basePath: BASE_PATH,
  // O browser chama a API pela mesma origem (`<basePath>/api/...`); o Next repassa ao Fastify.
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH ?? '' },
  // A raiz do domínio do painel (`gk-admin.…/`) não tem página; leva ao painel em vez de dar 404.
  async redirects() {
    return IS_ADMIN_BUILD ? [{ source: '/', destination: '/admin/', permanent: false }] : [];
  },
  async rewrites() {
    if (!API_INTERNAL_URL) return [];
    // Casa `/api/x` e `/api/x/`; o `destination` nunca leva barra final (o Fastify não casa rotas com barra).
    return [{ source: '/api/:path*', destination: `${API_INTERNAL_URL}/api/:path*` }];
  },
};

export default nextConfig;
