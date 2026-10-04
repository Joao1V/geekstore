import Anthropic from '@anthropic-ai/sdk';

import { BadRequestError, ExternalApiError } from '../_errors';
import { envConfig } from '../config';

const TIMEOUT_MS = 60_000;
const MAX_RETRIES = 1;

export type AiPrompt = { system: string; user: string };
/** Faz a pergunta e devolve o texto da resposta. Separado para os testes não chamarem a rede. */
export type AiComplete = (prompt: AiPrompt) => Promise<string>;

/** O cliente da IA configurado pelo ambiente (ANTHROPIC_API_KEY, AI_MODEL). Erro claro se faltar a chave. */
export function createCompleter(maxTokens: number): AiComplete {
  const { API_KEY, MODEL } = envConfig.ai;
  if (!API_KEY) {
    throw new BadRequestError(
      'A IA não está configurada: falta ANTHROPIC_API_KEY no ambiente da API.'
    );
  }
  const client = new Anthropic({ apiKey: API_KEY, timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES });
  return async ({ system, user }) => {
    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        temperature: 0,
        system,
        messages: [{ role: 'user', content: user }],
      });
      return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new ExternalApiError('A IA não respondeu agora. Tente de novo em instantes.', {
          status: error.status,
        });
      }
      throw error;
    }
  };
}
