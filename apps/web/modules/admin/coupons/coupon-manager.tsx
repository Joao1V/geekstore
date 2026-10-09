'use client';

import {
  COUPON_STATUS_LABELS,
  type Coupon,
  type CouponStatus,
  couponStatusSchema,
  formatBRL,
} from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Action } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { useCan } from '../lib/use-can';
import { useUrlState } from '../lib/use-url-state';
import { useDeleteCoupon, useUpdateCoupon } from '../services/pricing/mutations';
import { couponListQueryOptions } from '../services/pricing/queries';
import { Badge } from '../ui/badge';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { type FilterChip, FilterChips } from '../ui/filter-chips';
import { PageHeader } from '../ui/page-header';
import { PaginationBar } from '../ui/pagination-bar';
import { SearchBox } from '../ui/search-box';
import { AdminTable, EmptyRow, Td, Th } from '../ui/table';
import { CouponForm, type CouponFormTarget } from './coupon-form';

const PAGE_SIZE = 20;
const COLUMNS = 6;
const STATUS_TONES = {
  active: 'success',
  scheduled: 'info',
  expired: 'neutral',
  exhausted: 'warning',
  inactive: 'neutral',
} as const;
const STATUS_CHIPS: FilterChip[] = [
  { id: 'all', label: 'Todos' },
  ...couponStatusSchema.options.map((status) => ({
    id: status,
    label: COUPON_STATUS_LABELS[status],
  })),
];

function benefitOf(coupon: Coupon): string {
  if (coupon.kind === 'percent') return `${coupon.value}% de desconto`;
  if (coupon.kind === 'amount') return `${formatBRL(coupon.value)} de desconto`;
  return 'Frete grátis';
}

function validityOf(coupon: Coupon): string {
  if (!coupon.starts_at && !coupon.ends_at) return 'Sem prazo';
  const from = coupon.starts_at ? `de ${formatDateTime(coupon.starts_at)}` : '';
  const until = coupon.ends_at ? `até ${formatDateTime(coupon.ends_at)}` : '';
  return [from, until].filter(Boolean).join(' ');
}

/** Cupons de desconto: cadastro, situação ("posso usar agora?"), ativar/desativar e apagar. */
export function CouponManager() {
  const canWrite = useCan('pricing:write');
  const { searchParams, setParams, page } = useUrlState();
  const q = searchParams.get('q') ?? '';
  const status: CouponStatus | undefined = couponStatusSchema.options.find(
    (value) => value === searchParams.get('status')
  );
  const { data, isPending, error } = useQuery(
    couponListQueryOptions({ q: q || undefined, status, page, page_size: PAGE_SIZE })
  );
  const updateCoupon = useUpdateCoupon();
  const deleteCoupon = useDeleteCoupon();
  const [formTarget, setFormTarget] = useState<CouponFormTarget | null>(null);
  const [toDelete, setToDelete] = useState<Coupon | null>(null);
  const [actionError, setActionError] = useState('');

  const toggle = async (coupon: Coupon) => {
    setActionError('');
    try {
      await updateCoupon.mutateAsync({
        coupon_id: coupon.coupon_id,
        body: { is_active: !coupon.is_active },
      });
    } catch (failure) {
      setActionError(getErrorMessage(failure));
    }
  };
  const confirmDelete = async () => {
    if (!toDelete) return;
    setActionError('');
    try {
      await deleteCoupon.mutateAsync(toDelete.coupon_id);
      setToDelete(null);
    } catch (failure) {
      setActionError(getErrorMessage(failure));
    }
  };

  return (
    <div>
      <PageHeader
        title="Cupons"
        crumbs={[{ label: 'Vendas' }, { label: 'Cupons' }]}
        actions={
          canWrite && (
            <Action onPress={() => setFormTarget({})}>
              <Plus size={17} /> Novo cupom
            </Action>
          )
        }
      />
      <div className="mb-4 max-w-md">
        <SearchBox
          label="Buscar cupom"
          initialValue={q}
          onSearch={(value) => setParams({ q: value || null, page: null })}
        />
      </div>
      <FilterChips
        label="Filtrar cupons"
        chips={STATUS_CHIPS}
        active={status ?? 'all'}
        onSelect={(id) => setParams({ status: id === 'all' ? null : id, page: null })}
      />
      {(error || actionError) && (
        <p className="error mb-4" role="alert">
          {actionError || getErrorMessage(error)}
        </p>
      )}
      <AdminTable>
        <thead>
          <tr>
            <Th>Cupom</Th>
            <Th>Pedido mínimo</Th>
            <Th align="right">Usos</Th>
            <Th>Validade</Th>
            <Th>Situação</Th>
            <Th align="right">
              <span className="sr-only">Ações</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {isPending && <EmptyRow colSpan={COLUMNS}>Carregando…</EmptyRow>}
          {data?.data.map((coupon) => (
            <tr key={coupon.coupon_id} className="hover:bg-surface-secondary/50">
              <Td>
                <strong className="font-mono">{coupon.code}</strong>
                <span className="muted block text-xs">{benefitOf(coupon)}</span>
              </Td>
              <Td>{coupon.min_subtotal_cents ? formatBRL(coupon.min_subtotal_cents) : '—'}</Td>
              <Td align="right" className="tabular-nums">
                {coupon.uses}
                {coupon.max_uses !== null && <span className="muted"> / {coupon.max_uses}</span>}
              </Td>
              <Td className="text-xs">{validityOf(coupon)}</Td>
              <Td>
                <Badge tone={STATUS_TONES[coupon.status]}>
                  {COUPON_STATUS_LABELS[coupon.status]}
                </Badge>
              </Td>
              <Td align="right">
                {canWrite && (
                  <div className="inline-flex gap-2">
                    <button
                      type="button"
                      aria-label={`${coupon.is_active ? 'Desativar' : 'Ativar'} ${coupon.code}`}
                      title={coupon.is_active ? 'Desativar' : 'Ativar'}
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:border-ink"
                      onClick={() => toggle(coupon)}
                    >
                      <Power
                        size={16}
                        className={coupon.is_active ? 'text-status-success' : 'text-muted'}
                      />
                    </button>
                    <button
                      type="button"
                      aria-label={`Editar ${coupon.code}`}
                      title="Editar"
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:border-ink"
                      onClick={() => setFormTarget({ coupon })}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Apagar ${coupon.code}`}
                      title="Apagar"
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-border hover:border-status-error hover:text-status-error"
                      onClick={() => {
                        setActionError('');
                        setToDelete(coupon);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </Td>
            </tr>
          ))}
          {data && data.data.length === 0 && (
            <EmptyRow colSpan={COLUMNS}>
              {q || status
                ? 'Nenhum cupom com esse filtro.'
                : 'Nenhum cupom ainda. Crie o primeiro.'}
            </EmptyRow>
          )}
        </tbody>
      </AdminTable>
      {data && (
        <PaginationBar meta={data.meta} onPage={(next) => setParams({ page: String(next) })} />
      )}
      <CouponForm target={formTarget} onClose={() => setFormTarget(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Apagar cupom"
        confirmLabel="Apagar"
        onConfirm={confirmDelete}
        isPending={deleteCoupon.isPending}
        error={toDelete ? actionError : undefined}
      >
        Apagar o cupom <strong>{toDelete?.code}</strong>? Só cupom que nunca foi usado pode ser
        apagado; os já usados se desativam.
      </ConfirmDialog>
    </div>
  );
}
