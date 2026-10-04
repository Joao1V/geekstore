import type { ZipLookup } from '@geekstore/shared';

import { NotFoundError } from '../../core/_errors';

// Consulta de CEP no ViaCEP (público, sem chave): só o CEP sai daqui. Respostas ficam em memória.
const VIACEP_URL = 'https://viacep.com.br/ws';
const TIMEOUT_MS = 3_000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHED = 2_000;

const cache = new Map<string, { value: ZipLookup; expiresAt: number }>();

type ViaCepAnswer = {
  erro?: boolean | string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export async function lookupZip(zip: string): Promise<ZipLookup> {
  const cached = cache.get(zip);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let answer: ViaCepAnswer;
  try {
    const response = await fetch(`${VIACEP_URL}/${zip}/json/`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`ViaCEP ${response.status}`);
    answer = (await response.json()) as ViaCepAnswer;
  } catch {
    // Fora do ar ou lento: a pessoa preenche o endereço à mão (a tela já prevê isso).
    throw new NotFoundError('Não consegui consultar este CEP agora. Preencha o endereço à mão.');
  }
  if (answer.erro || !answer.localidade || !answer.uf) {
    throw new NotFoundError('CEP não encontrado.');
  }

  const value: ZipLookup = {
    zip,
    street: answer.logradouro ?? '',
    neighborhood: answer.bairro ?? '',
    city: answer.localidade,
    state: answer.uf,
  };
  if (cache.size >= MAX_CACHED) cache.clear();
  cache.set(zip, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Para os testes: esvazia o cache. */
export function clearZipCache(): void {
  cache.clear();
}
