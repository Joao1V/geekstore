// Cliente HTTP único do apps/web para falar com a apps/api. Compartilhado entre loja e admin,
// então NÃO pode importar de modules/admin nem de modules/store (o token do admin, por exemplo,
// entra pela opção `accessToken`). Ver a skill scaffolding-api-service.

import type { Paginated } from '@geekstore/shared';

// Browser: mesma origem (`<basePath>/api/...`), o Next repassa ao Fastify (next.config.ts).
// Servidor (RSC/prefetch): direto na API, pela URL interna, sem passar pelo proxy.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const NETWORK_ERROR_STATUS = 0;
const NETWORK_ERROR_MESSAGE = 'Não foi possível conectar ao servidor.';
const DEFAULT_ERROR_MESSAGE = 'Falha na requisição.';

type ParamValue = string | number | boolean | null | undefined;
export type ApiParams = Record<string, ParamValue | ParamValue[]>;

export type ApiRequestOptions = {
  params?: ApiParams;
  accessToken?: string | null;
} & Pick<RequestInit, 'cache' | 'next' | 'signal'>;

type ApiErrorBody = {
  error?: string;
  code?: string;
  message?: string;
  details?: unknown;
  request_id?: string;
};

/** Erro com o corpo padrão da API (`{ error, code, message, details?, request_id }`). `status` 0 = sem rede. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

function apiBaseUrl(): string {
  if (typeof window !== 'undefined') return BASE_PATH;
  const internalUrl = process.env.API_INTERNAL_URL;
  if (!internalUrl) throw new Error('API_INTERNAL_URL não está configurada.');
  return internalUrl;
}

// O rewrite do Next (trailingSlash: true) só casa `/api/x/`; sem a barra o browser paga um 308.
// No servidor a chamada vai direto ao Fastify, que não aceita a barra final.
function withProxyTrailingSlash(path: string): string {
  return typeof window !== 'undefined' && !path.endsWith('/') ? `${path}/` : path;
}

function buildUrl(path: string, params?: ApiParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null) query.append(key, String(item));
    }
  }
  const queryString = query.toString();
  return `${apiBaseUrl()}${withProxyTrailingSlash(path)}${queryString ? `?${queryString}` : ''}`;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const parsed = (body && typeof body === 'object' ? body : {}) as ApiErrorBody;
  return new ApiError(
    status,
    typeof parsed.code === 'string' ? parsed.code : 'request_error',
    typeof parsed.message === 'string' ? parsed.message : DEFAULT_ERROR_MESSAGE,
    parsed.details,
    typeof parsed.request_id === 'string' ? parsed.request_id : undefined
  );
}

// Devolve o corpo bruto da resposta (`{ data, meta? }`, ou undefined em 204).
async function request(
  method: string,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {}
): Promise<unknown> {
  const { params, accessToken, ...init } = options;
  const headers = new Headers();
  // Content-Type só com corpo: o Fastify rejeita JSON declarado com body vazio (ex.: /refresh).
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      ...init,
      method,
      headers,
      // Cookie do refresh token (HttpOnly). No servidor (RSC) não há cookie do browser: só
      // faça prefetch de rotas públicas.
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(NETWORK_ERROR_STATUS, 'network_error', NETWORK_ERROR_MESSAGE);
  }

  const data = await readBody(response);
  if (!response.ok) throw toApiError(response.status, data);
  return data;
}

/** Sucesso é sempre `{ data }`: o cliente entrega só o `data` (undefined em 204). */
async function requestData<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: ApiRequestOptions
): Promise<T> {
  const payload = (await request(method, path, body, options)) as { data: T } | undefined;
  return payload?.data as T;
}

export const api = {
  get: <T>(path: string, params?: ApiParams, options?: Omit<ApiRequestOptions, 'params'>) =>
    requestData<T>('GET', path, undefined, { ...options, params }),
  /** Listas: devolve `{ data, meta }` inteiro (paginação em `meta`). */
  paginate: async <T>(
    path: string,
    params?: ApiParams,
    options?: Omit<ApiRequestOptions, 'params'>
  ) => (await request('GET', path, undefined, { ...options, params })) as Paginated<T>,
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    requestData<T>('POST', path, body, options),
  put: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    requestData<T>('PUT', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    requestData<T>('PATCH', path, body, options),
  delete: <T>(path: string, options?: ApiRequestOptions) =>
    requestData<T>('DELETE', path, undefined, options),
};
