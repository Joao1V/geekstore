'use client';

import { type DuplicateGroup, formatBRL } from '@geekstore/shared';
import { Radio, RadioGroup } from '@heroui/react';
import { Merge } from 'lucide-react';
import { useState } from 'react';

import { Action } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatInteger } from '../lib/format';
import { useDismissDuplicates, useMergeDuplicates } from '../services/catalog/mutations';
import { Badge } from '../ui/badge';
import { Thumbnail } from '../ui/thumbnail';

const LEVEL_BADGE = {
  certain: { tone: 'success', label: 'Certeza' },
  likely: { tone: 'warning', label: 'Provável' },
  review: { tone: 'neutral', label: 'Revisar' },
} as const;

/** Um grupo de produtos repetidos: escolha o que fica, o resto é mesclado (o estoque soma). */
export function DuplicateGroupCard({
  group,
  canWrite,
}: {
  group: DuplicateGroup;
  canWrite: boolean;
}) {
  const [survivorId, setSurvivorId] = useState(group.suggested_survivor_sku_id);
  const [error, setError] = useState('');
  const merge = useMergeDuplicates();
  const dismiss = useDismissDuplicates();
  const busy = merge.isPending || dismiss.isPending;
  const badge = LEVEL_BADGE[group.level];

  const run = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <article className="surface grid gap-4 p-5 max-md:p-4" aria-label={group.items[0]?.name}>
      <header className="flex flex-wrap items-center gap-3">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <p className="muted text-xs">{group.reasons.join(' · ')}</p>
        <p className="ml-auto text-sm">
          Estoque somado:{' '}
          <strong className="tabular-nums">{formatInteger(group.total_stock)}</strong>
        </p>
      </header>
      <RadioGroup
        aria-label="Qual produto fica?"
        value={survivorId}
        onChange={setSurvivorId}
        isDisabled={!canWrite}
        className="grid gap-2"
      >
        {group.items.map((item) => {
          const keeps = item.sku_id === survivorId;
          return (
            <Radio key={item.sku_id} value={item.sku_id} className="block">
              <Radio.Content
                className={`grid w-full cursor-pointer grid-cols-[auto_56px_1fr_auto] items-center gap-3 rounded-xl border-2 p-3 max-md:grid-cols-[auto_48px_1fr] ${keeps ? 'border-geek-yellow bg-geek-yellow/10' : 'border-border'}`}
              >
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                <Thumbnail src={item.thumbnail_url} />
                <span className="min-w-0">
                  <strong className="block truncate">{item.name}</strong>
                  <span className="muted block font-mono text-2xs">
                    {item.code}
                    {item.legacy_code && ` · ERP ${item.legacy_code}`}
                    {item.ean && ` · EAN ${item.ean}`}
                  </span>
                  <span className="text-xs">
                    {keeps ? (
                      <strong className="text-status-success">Este fica</strong>
                    ) : (
                      <span className="muted">Será mesclado neste</span>
                    )}
                    {item.photos === 0 && <span className="muted"> · sem foto</span>}
                  </span>
                </span>
                <span className="text-right text-sm max-md:col-span-3 max-md:text-left">
                  <strong className="block tabular-nums">
                    {item.price_cents === null ? 'Sem preço' : formatBRL(item.price_cents)}
                  </strong>
                  <span className="muted tabular-nums">{formatInteger(item.stock)} un.</span>
                </span>
              </Radio.Content>
            </Radio>
          );
        })}
      </RadioGroup>
      {error && (
        <p className="error m-0" role="alert">
          {error}
        </p>
      )}
      {canWrite && (
        <div className="flex flex-wrap justify-end gap-3">
          <Action
            className="action-outline"
            disabled={busy}
            onPress={() => run(() => dismiss.mutateAsync(group.items.map((item) => item.sku_id)))}
          >
            São produtos diferentes
          </Action>
          <Action
            disabled={busy}
            onPress={() =>
              run(() =>
                merge.mutateAsync({
                  survivor_sku_id: survivorId,
                  duplicate_sku_ids: group.items
                    .filter((item) => item.sku_id !== survivorId)
                    .map((item) => item.sku_id),
                })
              )
            }
          >
            <Merge size={17} /> {merge.isPending ? 'Mesclando…' : 'Mesclar'}
          </Action>
        </div>
      )}
    </article>
  );
}
