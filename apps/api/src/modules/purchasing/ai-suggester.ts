import type { SkuSuggestion } from '@geekstore/shared';
import { z } from 'zod';

import { type AiComplete, type AiPrompt, createCompleter } from '../../core/ai/complete';

// A IA só ESCOLHE entre SKUs que já existem (candidatos achados por nome): nunca cria SKU nem inventa
// código. O que sai daqui é uma sugestão; quem liga o item é a pessoa.
const MAX_TOKENS = 300;
const MAX_REASON = 160;

export type AiItem = {
  description: string;
  supplierCode: string | null;
  ean: string | null;
  ncm: string | null;
};

const SYSTEM = `Você ajuda uma loja de itens geek (colecionáveis, mangás, jogos, canecas, roupas) a dar entrada em notas fiscais de compra.
Dado o item de uma nota e uma lista numerada de produtos já cadastrados, diga qual deles é EXATAMENTE o mesmo item.
Regras:
- Só vale o mesmo personagem/título, a mesma edição ou volume, o mesmo tamanho/capacidade e a mesma cor. Item parecido mas diferente NÃO vale.
- Se nenhum candidato for claramente o mesmo item, responda com choice null. Na dúvida, null.
- confidence "high" só quando TODAS as características da descrição aparecem no candidato (personagem, tipo, tamanho, cor, variação). Se sobrar ou faltar algo relevante (ex.: "bebê", "frutas", uma cor), use "medium" ou "low".
- Descrições de nota são abreviadas e sem acento ("CANECA MELHOR PAI DOG 300ML"); considere isso.
Responda SOMENTE um JSON, sem texto fora dele: {"choice": <número do candidato ou null>, "confidence": "high"|"medium"|"low", "reason": "<uma frase curta em português>"}`;

export function buildPrompt(item: AiItem, candidates: readonly SkuSuggestion[]): AiPrompt {
  const lines = candidates.map(
    (candidate, index) => `${index + 1}. ${candidate.code} — ${candidate.product_name}`
  );
  const details = [
    `Descrição na nota: ${item.description}`,
    item.supplierCode ? `Código do fornecedor: ${item.supplierCode}` : null,
    item.ean ? `EAN: ${item.ean}` : null,
    item.ncm ? `NCM: ${item.ncm}` : null,
  ].filter(Boolean);
  return { system: SYSTEM, user: `${details.join('\n')}\n\nCandidatos:\n${lines.join('\n')}` };
}

const answerSchema = z.object({
  choice: z.number().int().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string(),
});
export type AiAnswer = z.infer<typeof answerSchema>;

/** Lê o JSON da resposta, mesmo quando vem dentro de um bloco de código ou com texto em volta. */
export function parseAnswer(text: string): AiAnswer | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = answerSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Pergunta à IA qual dos candidatos é o item da nota. Devolve esse candidato marcado como sugestão da
 * IA, ou `null` quando ela não tem certeza. Sem candidatos nem chama a IA (não há o que escolher).
 */
export async function pickWithAi(
  item: AiItem,
  candidates: readonly SkuSuggestion[],
  complete?: AiComplete
): Promise<SkuSuggestion | null> {
  if (candidates.length === 0) return null;
  const answer = parseAnswer(
    await (complete ?? createCompleter(MAX_TOKENS))(buildPrompt(item, candidates))
  );
  if (!answer || answer.choice === null) return null;
  const chosen = candidates[answer.choice - 1];
  if (!chosen) return null; // número fora da lista: a IA se enganou, não vale
  return {
    ...chosen,
    source: 'ai',
    confidence: answer.confidence,
    reason: answer.reason.trim().slice(0, MAX_REASON) || null,
  };
}
