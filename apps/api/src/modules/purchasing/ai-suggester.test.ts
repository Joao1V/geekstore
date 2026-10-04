import type { SkuSuggestion } from '@geekstore/shared';
import { describe, expect, it, vi } from 'vitest';

import { buildPrompt, parseAnswer, pickWithAi } from './ai-suggester';

const candidate = (n: number, name: string): SkuSuggestion => ({
  sku_id: `00000000-0000-4000-8000-00000000000${n}`,
  code: `CNC-0000${n}`,
  product_name: name,
  score: 0.5,
  source: 'name',
  confidence: null,
  reason: null,
});

const candidates = [
  candidate(1, 'Caneca Melhor Pai de Dog 300ML'),
  candidate(2, 'Caneca Melhor Pai de Gato 300ML'),
];
const item = {
  description: 'CANECA MELHOR PAI DOG 300ML',
  supplierCode: 'CT-22',
  ean: null,
  ncm: '69120000',
};

describe('buildPrompt', () => {
  it('lists the candidates numbered and the item details, without private data', () => {
    const { user, system } = buildPrompt(item, candidates);
    expect(user).toContain('Descrição na nota: CANECA MELHOR PAI DOG 300ML');
    expect(user).toContain('Código do fornecedor: CT-22');
    expect(user).toContain('1. CNC-00001 — Caneca Melhor Pai de Dog 300ML');
    expect(user).toContain('2. CNC-00002 — Caneca Melhor Pai de Gato 300ML');
    expect(user).not.toContain('EAN:'); // sem EAN, a linha não aparece
    expect(system).toContain('choice null');
  });
});

describe('parseAnswer', () => {
  it('reads plain JSON, a fenced block and JSON with text around it', () => {
    const json = '{"choice": 1, "confidence": "high", "reason": "Mesmo personagem e tamanho."}';
    expect(parseAnswer(json)?.choice).toBe(1);
    expect(parseAnswer(`\`\`\`json\n${json}\n\`\`\``)?.choice).toBe(1);
    expect(parseAnswer(`Claro! ${json} Espero ter ajudado.`)?.choice).toBe(1);
    expect(
      parseAnswer('{"choice": null, "confidence": "low", "reason": "Nenhum."}')?.choice
    ).toBeNull();
  });

  it('refuses answers that do not follow the format', () => {
    expect(parseAnswer('não sei')).toBeNull();
    expect(parseAnswer('{"choice": "um"}')).toBeNull();
    expect(parseAnswer('{"choice": 1, "confidence": "certeza", "reason": "x"}')).toBeNull();
    expect(parseAnswer('{ quebrado')).toBeNull();
  });
});

describe('pickWithAi', () => {
  const answer = (choice: number | null, confidence = 'high') =>
    vi.fn().mockResolvedValue(JSON.stringify({ choice, confidence, reason: 'Mesmo item.' }));

  it('marks the chosen candidate as the AI suggestion', async () => {
    const picked = await pickWithAi(item, candidates, answer(1));
    expect(picked).toMatchObject({
      code: 'CNC-00001',
      source: 'ai',
      confidence: 'high',
      reason: 'Mesmo item.',
    });
  });

  it('returns null when the AI is not sure, picks a number off the list, or answers badly', async () => {
    expect(await pickWithAi(item, candidates, answer(null, 'low'))).toBeNull();
    expect(await pickWithAi(item, candidates, answer(9))).toBeNull();
    expect(await pickWithAi(item, candidates, answer(0))).toBeNull();
    expect(
      await pickWithAi(item, candidates, vi.fn().mockResolvedValue('talvez o primeiro'))
    ).toBeNull();
  });

  it('does not call the AI when there is nothing to choose from', async () => {
    const complete = answer(1);
    expect(await pickWithAi(item, [], complete)).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });

  it('truncates a long reason', async () => {
    const complete = vi
      .fn()
      .mockResolvedValue(
        JSON.stringify({ choice: 1, confidence: 'medium', reason: 'x'.repeat(500) })
      );
    expect((await pickWithAi(item, candidates, complete))?.reason).toHaveLength(160);
  });
});
