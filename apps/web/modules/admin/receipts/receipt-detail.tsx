'use client';

import { formatBRL } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { PackagePlus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Action } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { useCan } from '../lib/use-can';
import {
  useDeleteReceipt,
  usePostReceipt,
  useUpdateReceiptItem,
} from '../services/purchasing/mutations';
import { receiptDetailQueryOptions } from '../services/purchasing/queries';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { PageHeader } from '../ui/page-header';
import { AdminTable, TBody, THead, Th } from '../ui/table';
import { ReceiptItemRow } from './receipt-item-row';
import { ReceiptStatusBadge } from './receipt-status';

/** Uma nota de entrada: ligar os itens aos SKUs e, quando tudo estiver ligado, lançar no estoque. */
export function ReceiptDetail({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const canWrite = useCan('stock:write');
  const { data: receipt, isPending, error } = useQuery(receiptDetailQueryOptions(receiptId));
  const update = useUpdateReceiptItem(receiptId);
  const post = usePostReceipt(receiptId);
  const remove = useDeleteReceipt(receiptId);
  const [confirm, setConfirm] = useState<'post' | 'delete' | null>(null);
  const [actionError, setActionError] = useState('');

  if (isPending) return <p className="muted">Carregando…</p>;
  if (error || !receipt) {
    return (
      <p className="error" role="alert">
        {getErrorMessage(error)}
      </p>
    );
  }

  const editable = canWrite && receipt.status === 'draft';
  const toEnter = receipt.items.filter((item) => item.sku && !item.ignored);
  const units = toEnter.reduce((sum, item) => sum + item.quantity, 0);

  const run = async (action: () => Promise<unknown>) => {
    setActionError('');
    try {
      await action();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title={receipt.number ? `Nota ${receipt.number}` : 'Nota de entrada'}
        crumbs={[
          { label: 'Estoque' },
          { label: 'Notas de entrada', href: '/admin/notas/' },
          { label: receipt.number ? `Nota ${receipt.number}` : 'Nota de entrada' },
        ]}
        eyebrow={receipt.supplier?.name ?? 'Sem fornecedor'}
        actions={
          editable && (
            <>
              <Action className="action-outline" onPress={() => setConfirm('delete')}>
                <Trash2 size={16} /> Apagar rascunho
              </Action>
              <Action onPress={() => setConfirm('post')} disabled={receipt.unmatched_count > 0}>
                <PackagePlus size={17} /> Lançar no estoque
              </Action>
            </>
          )
        }
      />
      <dl className="surface mb-4 grid grid-cols-4 gap-4 p-4 text-sm max-md:grid-cols-2">
        <div>
          <dt className="muted text-xs">Situação</dt>
          <dd className="m-0 mt-1">
            <ReceiptStatusBadge status={receipt.status} />
          </dd>
        </div>
        <div>
          <dt className="muted text-xs">Emissão</dt>
          <dd className="m-0 mt-1 font-extrabold">
            {receipt.issued_at ? formatDateTime(receipt.issued_at) : '—'}
          </dd>
        </div>
        <div>
          <dt className="muted text-xs">Total da nota</dt>
          <dd className="m-0 mt-1 font-extrabold">{formatBRL(receipt.total_cents)}</dd>
        </div>
        <div>
          <dt className="muted text-xs">Itens sem SKU</dt>
          <dd className="m-0 mt-1 font-extrabold">{receipt.unmatched_count}</dd>
        </div>
      </dl>
      {editable && receipt.unmatched_count > 0 && (
        <p className="notice mb-4" role="status">
          Ligue cada item a um SKU (ou ignore, como frete) para poder lançar a nota. O que tem EAN
          já cadastrado foi ligado sozinho.
        </p>
      )}
      {actionError && (
        <p className="error mb-4" role="alert">
          {actionError}
        </p>
      )}
      <AdminTable label="Itens da nota">
        <THead>
          <Th isRowHeader>#</Th>
          <Th>Item da nota</Th>
          <Th align="right">Qtde</Th>
          <Th align="right">Custo un.</Th>
          <Th align="right">Total</Th>
          <Th>SKU</Th>
          <Th />
        </THead>
        <TBody>
          {receipt.items.map((item) => (
            <ReceiptItemRow
              key={item.receipt_item_id}
              receiptId={receiptId}
              item={item}
              editable={editable}
              isUpdating={update.isPending}
              onLink={(itemId, skuId) =>
                run(() => update.mutateAsync({ itemId, body: { sku_id: skuId } }))
              }
              onIgnore={(itemId, ignored) =>
                run(() => update.mutateAsync({ itemId, body: { ignored } }))
              }
            />
          ))}
        </TBody>
      </AdminTable>
      <ConfirmDialog
        open={confirm === 'post'}
        onClose={() => setConfirm(null)}
        title="Lançar no estoque?"
        confirmLabel="Lançar"
        isPending={post.isPending}
        onConfirm={() =>
          run(async () => {
            await post.mutateAsync();
            setConfirm(null);
          })
        }
      >
        Vão entrar <strong>{units}</strong> {units === 1 ? 'unidade' : 'unidades'} em{' '}
        <strong>{toEnter.length}</strong> {toEnter.length === 1 ? 'SKU' : 'SKUs'}, e o custo médio
        de cada um será atualizado. Depois de lançada, a nota não muda mais.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title="Apagar o rascunho?"
        confirmLabel="Apagar"
        isPending={remove.isPending}
        onConfirm={() =>
          run(async () => {
            await remove.mutateAsync();
            router.replace('/admin/notas/');
          })
        }
      >
        A nota some da lista e o estoque não é alterado. Dá para importar o XML de novo.
      </ConfirmDialog>
    </div>
  );
}
