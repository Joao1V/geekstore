import { z } from 'zod';

import type { AiComplete, AiPrompt } from '../../core/ai/complete';

// Faxina de nomes e franquias com IA. A IA SUGERE: o resultado vai para um arquivo de revisão, nunca
// direto para o banco, e ela nunca mexe no SKU (o código é imutável e vem da sequência).
export type CleanupInput = { id: string; name: string; category: string };
export type FranchiseOption = { slug: string; name: string };

export type CleanupSuggestion = {
  id: string;
  name: string;
  /** Franquia existente (slug), franquia nova (nome) ou nenhuma. */
  franchise: { kind: 'existing'; slug: string } | { kind: 'new'; name: string } | null;
  confidence: 'high' | 'medium' | 'low';
  /** Códigos de fabricante/ERP que saíram do nome, como estavam: guardados para a busca interna. */
  removed_codes: string[];
};

const SYSTEM = `Você organiza o catálogo de uma loja de itens geek (colecionáveis, mangás, jogos, canecas, roupas).
Para cada produto você devolve:
1. "name": o nome limpo para a vitrine, em português do Brasil. Tire códigos internos do fabricante e do ERP (ex.: MC49222HP, #DMG9040S-MK13, WZK71603, "e-Commerce"), mantendo o que ajuda o cliente (personagem, linha, tamanho, cor, capacidade, volume, quantidade de peças e o nº do set da LEGO quando for o identificador do produto). Nunca troque, some nem crie números. Corrija acentos e erros de digitação óbvios. NÃO invente nada que não esteja no nome. Se o nome já está bom, devolva igual.
2. "franchise": a franquia/universo do produto (Naruto, Disney, Overwatch...). Se estiver na lista de franquias existentes, devolva {"slug": "..."}. Se não estiver mas for uma franquia conhecida, devolva {"new": "Nome da Franquia"}. Se não houver franquia clara (item genérico), devolva null. Na dúvida, null.
3. "confidence": "high", "medium" ou "low".
4. "removed_codes": a lista dos códigos que você TIROU do nome, exatamente como estavam (ex.: ["MC49222HP", "CS2002"]); lista vazia se não tirou nenhum.
Responda SOMENTE um JSON, sem texto fora dele: [{"id": "...", "name": "...", "franchise": null | {"slug": "..."} | {"new": "..."}, "confidence": "high", "removed_codes": []}]`;

export function buildPrompt(
  items: readonly CleanupInput[],
  franchises: readonly FranchiseOption[]
): AiPrompt {
  const known = franchises.map((franchise) => `${franchise.slug} (${franchise.name})`).join(', ');
  const lines = items.map((item) => `${item.id} | ${item.category} | ${item.name}`);
  return {
    system: SYSTEM,
    user: `Franquias existentes: ${known}\n\nProdutos (id | categoria | nome):\n${lines.join('\n')}`,
  };
}

const answerSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string().trim().min(1).max(255),
    franchise: z.union([
      z.object({ slug: z.string() }),
      z.object({ new: z.string().trim().min(2).max(80) }),
      z.null(),
    ]),
    confidence: z.enum(['high', 'medium', 'low']),
    removed_codes: z.array(z.string()).default([]),
  })
);

/** Lê a resposta, mesmo com texto em volta, e só aceita ids pedidos e franquias existentes de verdade. */
export function parseCleanup(
  text: string,
  items: readonly CleanupInput[],
  franchises: readonly FranchiseOption[]
): CleanupSuggestion[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  let rows: z.infer<typeof answerSchema>;
  try {
    const parsed = answerSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    if (!parsed.success) return [];
    rows = parsed.data;
  } catch {
    return [];
  }

  const asked = new Set(items.map((item) => item.id));
  const slugs = new Set(franchises.map((franchise) => franchise.slug));
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (!asked.has(row.id) || seen.has(row.id)) return [];
    seen.add(row.id);
    const original = items.find((item) => item.id === row.id)?.name ?? '';
    if (introducesNewNumber(original, row.name)) return [];
    let franchise: CleanupSuggestion['franchise'] = null;
    if (row.franchise && 'slug' in row.franchise) {
      // Slug inventado pela IA não vale: vira "sem franquia" em vez de ligar à coleção errada.
      franchise = slugs.has(row.franchise.slug)
        ? { kind: 'existing', slug: row.franchise.slug }
        : null;
    } else if (row.franchise) {
      franchise = { kind: 'new', name: row.franchise.new };
    }
    // Só vale código que estava mesmo no nome original (a IA não inventa referência).
    const haystack = original.toLowerCase();
    const removed_codes = row.removed_codes
      .map((code) => code.trim())
      .filter(
        (code) => code.length > 0 && code.length <= 40 && haystack.includes(code.toLowerCase())
      );
    return [{ id: row.id, name: row.name, franchise, confidence: row.confidence, removed_codes }];
  });
}

const BATCH_SIZE = 20;

const numbersIn = (text: string): Set<string> =>
  new Set((text.match(/\d+/g) ?? []).map((digits) => String(Number(digits))));

/**
 * A trava contra invenção: o nome sugerido não pode ter número que o original não tinha (a IA já
 * trocou "2/5" por "/250"). Tirar número é permitido (códigos do fabricante); criar, não.
 */
export function introducesNewNumber(original: string, suggested: string): boolean {
  const before = numbersIn(original);
  return [...numbersIn(suggested)].some((digits) => !before.has(digits));
}

export type CleanupProgress = (done: number, total: number) => void;

/**
 * Pede a faxina em lotes de ~20, vários ao mesmo tempo. Lote que falha ou vem torto é pulado e contado
 * (nada trava a corrida inteira). `onBatch` recebe cada lote pronto, para gravar o progresso.
 */
export async function cleanupBatches(
  items: readonly CleanupInput[],
  franchises: readonly FranchiseOption[],
  complete: AiComplete,
  options: { concurrency?: number; onBatch?: (rows: CleanupSuggestion[]) => void } = {}
): Promise<{ suggestions: CleanupSuggestion[]; skipped: number }> {
  const { concurrency = 1, onBatch } = options;
  const batches: CleanupInput[][] = [];
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    batches.push(items.slice(start, start + BATCH_SIZE));
  }
  const suggestions: CleanupSuggestion[] = [];
  let skipped = 0;
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++] as CleanupInput[];
      try {
        const parsed = parseCleanup(
          await complete(buildPrompt(batch, franchises)),
          batch,
          franchises
        );
        suggestions.push(...parsed);
        skipped += batch.length - parsed.length;
        onBatch?.(parsed);
      } catch {
        skipped += batch.length;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return { suggestions, skipped };
}
