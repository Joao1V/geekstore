'use client';

import type { AuditLog } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, FieldInput } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { useUrlState } from '../lib/use-url-state';
import { auditLogsQueryOptions } from '../services/audit/queries';
import { Badge } from '../ui/badge';
import { PageHeader } from '../ui/page-header';
import { PaginationBar } from '../ui/pagination-bar';
import { AdminTable, EmptyRow, Td, Th } from '../ui/table';

const PAGE_SIZE = 20;
const ACTION_LABELS = { create: 'Criou', update: 'Alterou', delete: 'Excluiu' } as const;
const ACTION_TONES = { create: 'success', update: 'info', delete: 'error' } as const;

const filterSchema = z.object({
  entity: z.string().trim(),
  entity_id: z
    .string()
    .refine((value) => !value || z.uuid().safeParse(value).success, 'Use um UUID válido'),
});
type Filters = z.infer<typeof filterSchema>;

function Changes({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="text-xs font-extrabold underline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Ocultar' : 'Ver antes/depois'}
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-3 max-md:grid-cols-1">
          {(['before', 'after'] as const).map((side) => (
            <div key={side}>
              <p className="mb-1 text-xs font-extrabold text-muted uppercase">
                {side === 'before' ? 'Antes' : 'Depois'}
              </p>
              <pre className="max-h-60 overflow-auto rounded-lg bg-surface-secondary p-2 text-xs">
                {JSON.stringify(log[side], null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function AuditList() {
  const { searchParams, setParams, page } = useUrlState();
  const entity = searchParams.get('entity') ?? '';
  const entityId = searchParams.get('entity_id') ?? '';
  const { data, isPending, error } = useQuery(
    auditLogsQueryOptions({
      page,
      page_size: PAGE_SIZE,
      sort: 'created_at:desc',
      entity: entity || undefined,
      entity_id: entityId || undefined,
    })
  );

  const { control, handleSubmit, reset } = useForm<Filters>({
    resolver: zodResolver(filterSchema),
    values: { entity, entity_id: entityId },
  });

  return (
    <>
      <PageHeader title="Auditoria" />
      <form
        onSubmit={handleSubmit((values) =>
          setParams({ entity: values.entity, entity_id: values.entity_id.trim() })
        )}
        className="mb-5 grid grid-cols-[1fr_1.5fr_auto] items-start gap-4 max-md:grid-cols-1"
        noValidate
      >
        <Controller
          control={control}
          name="entity"
          render={({ field, fieldState }) => (
            <FieldInput
              field={field}
              fieldState={fieldState}
              label="Entidade"
              required={false}
              placeholder="product, sku, price…"
            />
          )}
        />
        <Controller
          control={control}
          name="entity_id"
          render={({ field, fieldState }) => (
            <FieldInput
              field={field}
              fieldState={fieldState}
              label="ID do registro"
              required={false}
              placeholder="UUID"
            />
          )}
        />
        <div className="flex gap-2 pt-7 max-md:pt-0">
          <Action type="submit">Filtrar</Action>
          <Action
            className="action-outline"
            onPress={() => {
              reset({ entity: '', entity_id: '' });
              setParams({ entity: null, entity_id: null });
            }}
          >
            Limpar
          </Action>
        </div>
      </form>
      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      <AdminTable>
        <thead>
          <tr>
            <Th>Quando</Th>
            <Th>Quem</Th>
            <Th>Ação</Th>
            <Th>Entidade</Th>
            <Th>Alterações</Th>
          </tr>
        </thead>
        <tbody>
          {isPending && <EmptyRow colSpan={5}>Carregando…</EmptyRow>}
          {data?.data.map((log) => (
            <tr key={log.audit_log_id}>
              <Td className="whitespace-nowrap">{formatDateTime(log.created_at)}</Td>
              <Td>{log.user_name ?? 'Sistema'}</Td>
              <Td>
                <Badge tone={ACTION_TONES[log.action]}>{ACTION_LABELS[log.action]}</Badge>
              </Td>
              <Td>
                <strong>{log.entity}</strong>
                <span className="muted block text-xs break-all">{log.entity_id}</span>
              </Td>
              <Td className="align-top">
                <Changes log={log} />
              </Td>
            </tr>
          ))}
          {data && !data.data.length && <EmptyRow colSpan={5}>Nenhum registro.</EmptyRow>}
        </tbody>
      </AdminTable>
      {data && (
        <PaginationBar meta={data.meta} onPage={(next) => setParams({ page: next }, false)} />
      )}
    </>
  );
}
