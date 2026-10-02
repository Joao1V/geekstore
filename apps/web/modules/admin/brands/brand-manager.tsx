'use client';

import type { Brand } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Action } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatInteger } from '../lib/format';
import { useCan } from '../lib/use-can';
import { brandsQueryOptions } from '../services/catalog/queries';
import { Badge } from '../ui/badge';
import { PageHeader } from '../ui/page-header';
import { SearchBox } from '../ui/search-box';
import { AdminTable, EmptyRow, Td, Th } from '../ui/table';
import { BrandForm, type BrandFormTarget } from './brand-form';

/** Texto sem acento nem pontuação, para o filtro local da lista ("pokemon" acha "Pokémon"). */
const compact = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function BrandManager() {
  const canWrite = useCan('catalog:write');
  const { data, isPending, error } = useQuery(brandsQueryOptions());
  const [target, setTarget] = useState<BrandFormTarget | null>(null);
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => {
    const needle = compact(filter);
    return (data ?? []).filter((brand) => !needle || compact(brand.name).includes(needle));
  }, [data, filter]);

  return (
    <>
      <PageHeader
        title="Marcas"
        actions={
          canWrite && (
            <Action onPress={() => setTarget({})}>
              <Plus size={17} /> Nova marca
            </Action>
          )
        }
      />
      <div className="mb-5 max-w-md">
        <SearchBox label="Buscar marca" initialValue="" onSearch={setFilter} />
      </div>
      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      <AdminTable>
        <thead>
          <tr>
            <Th>Marca</Th>
            <Th>Produtos</Th>
            <Th>Situação</Th>
            <Th align="right">
              <span className="sr-only">Ações</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {isPending && <EmptyRow colSpan={4}>Carregando…</EmptyRow>}
          {rows.map((brand: Brand) => (
            <tr key={brand.brand_id} className="hover:bg-surface-secondary/50">
              <Td>
                <strong>{brand.name}</strong>
                <span className="muted block font-mono text-2xs">{brand.slug}</span>
              </Td>
              <Td className="tabular-nums">{formatInteger(brand.product_count)}</Td>
              <Td>
                <Badge tone={brand.is_active ? 'success' : 'neutral'}>
                  {brand.is_active ? 'Ativa' : 'Inativa'}
                </Badge>
              </Td>
              <Td align="right">
                {canWrite && (
                  <button
                    type="button"
                    aria-label={`Editar ${brand.name}`}
                    className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:border-ink"
                    onClick={() => setTarget({ brand })}
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </Td>
            </tr>
          ))}
          {data && !rows.length && (
            <EmptyRow colSpan={4}>
              {filter ? 'Nenhuma marca com esse nome.' : 'Nenhuma marca ainda.'}
            </EmptyRow>
          )}
        </tbody>
      </AdminTable>
      <BrandForm target={target} onClose={() => setTarget(null)} />
    </>
  );
}
