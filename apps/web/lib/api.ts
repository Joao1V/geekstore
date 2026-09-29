// Cliente HTTP único do apps/web para falar com a apps/api. Compartilhado entre loja e admin,
// então NÃO pode importar de modules/admin nem de modules/store (o token do admin, por exemplo,
// entra pela opção `accessToken`). Ver a skill scaffolding-api-service.

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const NETWORK_ERROR_STATUS = 0;
const NETWORK_ERROR_MESSAGE = 'Não foi possível conectar ao servidor.';
const DEFAULT_ERROR_MESSAGE = 'Falha na requisição.';

type ParamValue = string | number | boolean | null | undefined;
export type ApiParams = Record<string, ParamValue | ParamValue[]>;

export type ApiRequestOptions = {
  params?: ApiParams;
  accessToken?: string | null;
} & Pick<RequestInit, 'cache' | 'next' | 'signal'>;

type ApiErrorBody = { error?: string; code?: string; message?: string; details?: unknown };

/** Erro com o corpo padrão da API (`{ error, code, message, details? }`). `status` 0 = sem rede. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildUrl(path: string, params?: ApiParams): string {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL não está configurada.');
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null) query.append(key, String(item));
    }
  }
  const queryString = query.toString();
  return `${API_URL}${path}${queryString ? `?${queryString}` : ''}`;
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
    parsed.details
  );
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {}
): Promise<T> {
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
  return data as T;
}

export const api = {
  get: <T>(path: string, params?: ApiParams, options?: Omit<ApiRequestOptions, 'params'>) =>
    request<T>('GET', path, undefined, { ...options, params }),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('POST', path, body, options),
  put: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('PUT', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>('PATCH', path, body, options),
  delete: <T>(path: string, options?: ApiRequestOptions) =>
    request<T>('DELETE', path, undefined, options),
};
