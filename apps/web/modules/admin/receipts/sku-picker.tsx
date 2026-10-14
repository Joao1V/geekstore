'use client';

import type { SkuGridRow, SkuSuggestion } from '@geekstore/shared';
import { Button } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

import { getErrorMessage } from '../lib/errors';
import { skuGridQueryOptions } from '../services/catalog/queries';
import { receiptSuggestionsQueryOptions } from '../services/purchasing/queries';
import { Badge } from '../ui/badge';
import { SearchBox } from '../ui/search-box';

const RESULTS = 6;

const OPTION =
  'flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm hover:bg-surface-secondary';

const CONFIDENCE_LABEL = {
  high: 'confiança alta',
  medium: 'confiança média',
  low: 'confiança baixa',
};
const CONFIDENCE_TONE = { high: 'success', medium: 'warning', low: 'neutral' } as const;

type Option = {
  skuId: string;
  code: string;
  name: string;
  note: string;
  ai: SkuSuggestion | null;
};

const fromSuggestion = (row: SkuSuggestion): Option => ({
  skuId: row.sku_id,
  code: row.code,
  name: row.product_name,
  note: `${Math.round(row.score * 100)}% parecido`,
  ai: row.source === 'ai' ? row : null,
});

/** Escolhe o SKU de um item da nota: os mais parecidos, a escolha da IA (a pedido) ou uma busca livre. */
export function SkuPicker({
  receiptId,
  itemId,
  disabled,
  onPick,
}: {
  receiptId: string;
  itemId: string;
  disabled: boolean;
  onPick: (skuId: string) => void;
}) {
  const [term, setTerm] = useState('');
  const [askAi, setAskAi] = useState(false);
  const { data: byName } = useQuery(receiptSuggestionsQueryOptions(receiptId, itemId));
  const ai = useQuery({
    ...receiptSuggestionsQueryOptions(receiptId, itemId, true),
    enabled: askAi,
    retry: false,
  });
  const { data: found } = useQuery({
    ...skuGridQueryOptions({ q: term || undefined, page_size: RESULTS }),
    enabled: term.length > 1,
  });

  const suggestions = askAi && ai.data ? ai.data : (byName ?? []);
  const aiPick = suggestions.find((row) => row.source === 'ai');
  const options: Option[] = term
    ? (found?.data ?? []).map((row: SkuGridRow) => ({
        skuId: row.sku_id,
        code: row.code,
        name: row.product_name,
        note: `${row.available} em estoque`,
        ai: null,
      }))
    : suggestions.map(fromSuggestion);

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-surface-secondary/40 p-3">
      <div className="grid grid-cols-[1fr_auto] items-end gap-3 max-md:grid-cols-1">
        <SearchBox
          label="Buscar SKU por nome ou código"
          initialValue=""
          onSearch={(value) => setTerm(value)}
        />
        <Button
          variant="outline"
          onPress={() => setAskAi(true)}
          isDisabled={disabled || ai.isFetching || askAi}
          className="h-[46px] rounded-xl px-4 text-sm font-extrabold"
        >
          <Sparkles size={16} aria-hidden="true" />
          {ai.isFetching ? 'Pensando…' : 'Perguntar à IA'}
        </Button>
      </div>
      {ai.error && (
        <p className="error m-0" role="alert">
          {getErrorMessage(ai.error)}
        </p>
      )}
      {askAi && ai.isSuccess && !aiPick && (
        <p className="muted m-0 text-sm">
          A IA não achou um candidato claramente igual. Veja os mais parecidos ou busque.
        </p>
      )}
      <p className="muted m-0 text-xs">
        {term ? 'Resultados da busca:' : 'Mais parecidos com a descrição da nota:'}
      </p>
      <ul className="m-0 grid list-none gap-2 p-0">
        {options.map((option) => (
          <li key={option.skuId}>
            <button
              type="button"
              className={`${OPTION} ${option.ai ? 'border-geek-yellow bg-geek-yellow/10' : ''}`}
              disabled={disabled}
              onClick={() => onPick(option.skuId)}
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  {option.ai?.confidence && (
                    <Badge tone={CONFIDENCE_TONE[option.ai.confidence]}>
                      IA · {CONFIDENCE_LABEL[option.ai.confidence]}
                    </Badge>
                  )}
                  <code className="font-mono text-xs">{option.code}</code>
                  <span className="truncate">{option.name}</span>
                </span>
                {option.ai?.reason && (
                  <span className="muted mt-1 block text-xs">{option.ai.reason}</span>
                )}
              </span>
              <span className="muted shrink-0 text-xs">{option.note}</span>
            </button>
          </li>
        ))}
        {options.length === 0 && (
          <li className="muted text-sm">
            {term ? 'Nenhum SKU encontrado.' : 'Sem sugestões: use a busca.'}
          </li>
        )}
      </ul>
    </div>
  );
}
