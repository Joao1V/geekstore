'use client';

import type { SkuGridRow, SkuSuggestion } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { skuGridQueryOptions } from '../services/catalog/queries';
import { receiptSuggestionsQueryOptions } from '../services/purchasing/queries';
import { SearchBox } from '../ui/search-box';

const RESULTS = 6;

const OPTION =
  'flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm hover:bg-surface-secondary';

/** Escolhe o SKU de um item da nota: os mais parecidos com a descrição, ou uma busca livre. */
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
  const { data: suggestions } = useQuery(receiptSuggestionsQueryOptions(receiptId, itemId));
  const { data: found } = useQuery({
    ...skuGridQueryOptions({ q: term || undefined, page_size: RESULTS }),
    enabled: term.length > 1,
  });

  const options: { skuId: string; code: string; name: string; note: string }[] = term
    ? (found?.data ?? []).map((row: SkuGridRow) => ({
        skuId: row.sku_id,
        code: row.code,
        name: row.product_name,
        note: `${row.available} em estoque`,
      }))
    : (suggestions ?? []).map((row: SkuSuggestion) => ({
        skuId: row.sku_id,
        code: row.code,
        name: row.product_name,
        note: `${Math.round(row.score * 100)}% parecido`,
      }));

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-surface-secondary/40 p-3">
      <SearchBox
        label="Buscar SKU por nome ou código"
        initialValue=""
        onSearch={(value) => setTerm(value)}
      />
      <p className="muted m-0 text-xs">
        {term ? 'Resultados da busca:' : 'Mais parecidos com a descrição da nota:'}
      </p>
      <ul className="m-0 grid list-none gap-2 p-0">
        {options.map((option) => (
          <li key={option.skuId}>
            <button
              type="button"
              className={OPTION}
              disabled={disabled}
              onClick={() => onPick(option.skuId)}
            >
              <span className="min-w-0">
                <code className="font-mono text-xs">{option.code}</code>
                <span className="ml-2 truncate">{option.name}</span>
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
