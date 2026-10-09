'use client';

import { PAGE_STATUS_LABELS } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';

import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { useCan } from '../lib/use-can';
import { pageListQueryOptions } from '../services/content/queries';
import { Badge } from '../ui/badge';
import { PageHeader } from '../ui/page-header';
import { AdminTable, EmptyRow, Td, Th } from '../ui/table';

/** Páginas institucionais da loja: trocas e devoluções, nos conheça, contato... */
export function PageManager() {
  const canWrite = useCan('content:write');
  const { data, isPending, error } = useQuery(pageListQueryOptions());

  return (
    <div>
      <PageHeader
        title="Páginas"
        crumbs={[{ label: 'Conteúdo' }, { label: 'Páginas' }]}
        actions={
          canWrite && (
            <Link href="/admin/paginas/nova/" className="action">
              <Plus size={17} /> Nova página
            </Link>
          )
        }
      />
      <p className="muted mb-4 max-w-2xl text-sm">
        Textos fixos da loja. Só as páginas <strong>publicadas</strong> aparecem no rodapé e em{' '}
        <code>/pagina/endereço</code>; os rascunhos ficam só aqui.
      </p>
      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      <AdminTable>
        <thead>
          <tr>
            <Th>Página</Th>
            <Th>Endereço</Th>
            <Th>Situação</Th>
            <Th>Atualizada</Th>
          </tr>
        </thead>
        <tbody>
          {isPending && <EmptyRow colSpan={4}>Carregando…</EmptyRow>}
          {data?.map((page) => (
            <tr key={page.page_id} className="hover:bg-surface-secondary/50">
              <Td>
                <Link
                  href={`/admin/paginas/${page.page_id}/`}
                  className="font-extrabold underline-offset-4 hover:underline"
                >
                  {page.title}
                </Link>
              </Td>
              <Td className="font-mono text-xs">/pagina/{page.slug}/</Td>
              <Td>
                <Badge tone={page.status === 'published' ? 'success' : 'warning'}>
                  {PAGE_STATUS_LABELS[page.status]}
                </Badge>
              </Td>
              <Td className="text-xs">{formatDateTime(page.updated_at)}</Td>
            </tr>
          ))}
          {data && data.length === 0 && (
            <EmptyRow colSpan={4}>
              Nenhuma página ainda.{' '}
              {canWrite && (
                <Link href="/admin/paginas/nova/" className="font-extrabold underline">
                  Crie a primeira
                </Link>
              )}
            </EmptyRow>
          )}
        </tbody>
      </AdminTable>
    </div>
  );
}
