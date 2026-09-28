import type { AuthLoginBody, AuthSessionResponse } from '@geekstore/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body.message === 'string' ? body.message : 'Falha na requisição.';
    throw new Error(message);
  }
  return body as T;
}

export async function login(credentials: AuthLoginBody): Promise<AuthSessionResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  return parseJsonOrThrow<AuthSessionResponse>(response);
}

export async function refreshSession(): Promise<AuthSessionResponse> {
  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  return parseJsonOrThrow<AuthSessionResponse>(response);
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}
