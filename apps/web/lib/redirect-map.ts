import { normalizeRedirectPath, type RedirectMap } from '@geekstore/shared';

// Mapa de redirecionamentos 301 (loja antiga -> nova), guardado em memória no servidor do Next. Vem da
// API (`/api/store/redirects`, centenas de linhas curtas) e é renovado a cada 5 minutos SEM travar o
// pedido que o encontrou vencido. Se a API estiver fora, a loja continua abrindo, só sem redirecionar.

const TTL_MS = 5 * 60_000;
const RETRY_MS = 15_000;
const FETCH_TIMEOUT_MS = 1_500;

let cache: { loadedAt: number; ttl: number; map: Map<string, string> } | null = null;
let refreshing: Promise<void> | null = null;

async function fetchMap(): Promise<Map<string, string>> {
  const base = process.env.API_INTERNAL_URL;
  if (!base) return new Map();
  const response = await fetch(`${base}/api/store/redirects`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`redirects: ${response.status}`);
  const body = (await response.json()) as { data: RedirectMap };
  return new Map(body.data);
}

function refresh(): Promise<void> {
  refreshing ??= fetchMap()
    .then((map) => {
      cache = { loadedAt: Date.now(), ttl: TTL_MS, map };
    })
    .catch(() => {
      // Mantém o mapa que já havia e tenta de novo em instantes.
      cache = { loadedAt: Date.now(), ttl: RETRY_MS, map: cache?.map ?? new Map() };
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Endereço novo para este caminho (já com barra no fim), ou `null` se não há redirecionamento. */
export async function findRedirect(pathname: string): Promise<string | null> {
  if (!cache) await refresh();
  else if (Date.now() - cache.loadedAt > cache.ttl) void refresh();
  return cache?.map.get(normalizeRedirectPath(pathname)) ?? null;
}
