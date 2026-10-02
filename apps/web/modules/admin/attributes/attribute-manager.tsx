'use client';

import type { Attribute } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { Action } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { useCan } from '../lib/use-can';
import { attributesQueryOptions } from '../services/catalog/queries';
import { Badge } from '../ui/badge';
import { PageHeader } from '../ui/page-header';
import { AdminTable, EmptyRow, Td, Th } from '../ui/table';
import { AttributeForm, type AttributeFormTarget } from './attribute-form';

const PREVIEW_VALUES = 8;

function valuesPreview(attribute: Attribute): string {
  const active = attribute.values.filter((value) => value.is_active);
  const shown = active.slice(0, PREVIEW_VALUES).map((value) => value.label);
  const more = active.length - shown.length;
  return more > 0 ? `${shown.join(', ')} e mais ${more}` : shown.join(', ');
}

export function AttributeManager() {
  const canWrite = useCan('catalog:write');
  const { data, isPending, error } = useQuery(attributesQueryOptions());
  const [target, setTarget] = useState<AttributeFormTarget | null>(null);

  return (
    <>
      <PageHeader
        title="Atributos"
        actions={
          canWrite && (
            <Action onPress={() => setTarget({})}>
              <Plus size={17} /> Novo atributo
            </Action>
          )
        }
      />
      <p className="muted mb-5 max-w-3xl text-sm">
        Características que geram os SKUs de um produto com variações (cor, tamanho, edição…). O
        código de cada valor vira o final do SKU: <strong>NAR-KUN</strong> + <strong>PT</strong> +{' '}
        <strong>GG</strong> = <code className="font-mono">NAR-KUN-PT-GG</code>.
      </p>
      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      <AdminTable>
        <thead>
          <tr>
            <Th>Atributo</Th>
            <Th>Valores</Th>
            <Th>Qtde.</Th>
            <Th>Situação</Th>
            <Th align="right">
              <span className="sr-only">Ações</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {isPending && <EmptyRow colSpan={5}>Carregando…</EmptyRow>}
          {data?.map((attribute) => (
            <tr key={attribute.attribute_id} className="hover:bg-surface-secondary/50">
              <Td className="whitespace-nowrap">
                <strong>{attribute.name}</strong>
                <span className="muted block font-mono text-2xs">{attribute.code}</span>
              </Td>
              <Td className="max-w-xl text-sm">{valuesPreview(attribute) || '—'}</Td>
              <Td className="tabular-nums">{attribute.values.length}</Td>
              <Td>
                <Badge tone={attribute.is_active ? 'success' : 'neutral'}>
                  {attribute.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </Td>
              <Td align="right">
                {canWrite && (
                  <button
                    type="button"
                    aria-label={`Editar ${attribute.name}`}
                    className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:border-ink"
                    onClick={() => setTarget({ attribute })}
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </Td>
            </tr>
          ))}
          {data && !data.length && <EmptyRow colSpan={5}>Nenhum atributo ainda.</EmptyRow>}
        </tbody>
      </AdminTable>
      <AttributeForm target={target} onClose={() => setTarget(null)} />
    </>
  );
}
