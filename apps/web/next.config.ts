import type { NextConfig } from 'next';

// URL da API vista pelo servidor do Next (rede interna). Nunca vai para o bundle do browser.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL;
const BASE_PATH = process.env.BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: 'standalone',
  trailingSlash: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
  basePath: BASE_PATH,
  // O browser chama a API pela mesma origem (`<basePath>/api/...`); o Next repassa ao Fastify.
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH ?? '' },
  async rewrites() {
    if (!API_INTERNAL_URL) return [];
    // Com trailingSlash: true o `source` leva barra final e o `destination` não (o Fastify não
    // casa rotas com barra). Ver docs do Next 16, "Rewriting to an external URL".
    return [{ source: '/api/:path*/', destination: `${API_INTERNAL_URL}/api/:path*` }];
  },
};

export default nextConfig;
