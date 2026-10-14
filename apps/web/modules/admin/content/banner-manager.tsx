'use client';

import type { Banner } from '@geekstore/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Action, IconAction } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { useCan } from '../lib/use-can';
import { useDeleteBanner, useReorderBanners, useUpdateBanner } from '../services/content/mutations';
import { bannerListQueryOptions } from '../services/content/queries';
import { Badge } from '../ui/badge';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { PageHeader } from '../ui/page-header';
import { AdminTable, EmptyRow, TBody, Td, THead, Th, Tr } from '../ui/table';
import { BannerForm, type BannerFormTarget } from './banner-form';

type BannerStatus = 'active' | 'scheduled' | 'expired' | 'inactive';
const STATUS_LABELS: Record<BannerStatus, string> = {
  active: 'No ar',
  scheduled: 'Agendado',
  expired: 'Vencido',
  inactive: 'Desativado',
};
const STATUS_TONES = {
  active: 'success',
  scheduled: 'info',
  expired: 'neutral',
  inactive: 'neutral',
} as const;

/** "Está aparecendo agora?" — a mesma regra que a loja usa (ativo e dentro da janela de datas). */
function statusOf(banner: Banner, now = Date.now()): BannerStatus {
  if (!banner.is_active) return 'inactive';
  if (banner.ends_at && Date.parse(banner.ends_at) <= now) return 'expired';
  if (banner.starts_at && Date.parse(banner.starts_at) > now) return 'scheduled';
  return 'active';
}

function windowOf(banner: Banner): string {
  if (!banner.starts_at && !banner.ends_at) return 'Sem prazo';
  return [
    banner.starts_at ? `de ${formatDateTime(banner.starts_at)}` : '',
    banner.ends_at ? `até ${formatDateTime(banner.ends_at)}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Banners do carrossel da home: ordem, ativar, datas e imagem. */
export function BannerManager() {
  const canWrite = useCan('content:write');
  const { data, isPending, error } = useQuery(bannerListQueryOptions());
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();
  const reorder = useReorderBanners();
  const [formTarget, setFormTarget] = useState<BannerFormTarget | null>(null);
  const [toDelete, setToDelete] = useState<Banner | null>(null);
  const [actionError, setActionError] = useState('');

  const run = async (action: () => Promise<unknown>) => {
    setActionError('');
    try {
      await action();
    } catch (failure) {
      setActionError(getErrorMessage(failure));
    }
  };

  const move = (index: number, step: -1 | 1) => {
    const ids = (data ?? []).map((banner) => banner.banner_id);
    const target = index + step;
    if (target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target] as string, next[index] as string];
    return run(() => reorder.mutateAsync(next));
  };

  const rows = data ?? [];
  const busy = reorder.isPending || updateBanner.isPending;

  return (
    <div>
      <PageHeader
        title="Banners da home"
        crumbs={[{ label: 'Conteúdo' }, { label: 'Banners' }]}
        actions={
          canWrite && (
            <Action onPress={() => setFormTarget({})}>
              <Plus size={17} /> Novo banner
            </Action>
          )
        }
      />
      <p className="muted mb-4 max-w-2xl text-sm">
        O carrossel do topo da loja. A ordem desta lista é a ordem na loja. Se nenhum banner estiver
        no ar, a loja mostra os dois padrões.
      </p>
      {(error || actionError) && (
        <p className="error mb-4" role="alert">
          {actionError || getErrorMessage(error)}
        </p>
      )}
      <AdminTable label="Banners">
        <THead>
          <Th isRowHeader>Ordem</Th>
          <Th>Banner</Th>
          <Th>Botão</Th>
          <Th>Exibição</Th>
          <Th>Situação</Th>
          <Th align="right">
            <span className="sr-only">Ações</span>
          </Th>
        </THead>
        <TBody>
          {isPending && <EmptyRow colSpan={6}>Carregando…</EmptyRow>}
          {rows.map((banner, index) => {
            const status = statusOf(banner);
            return (
              <Tr key={banner.banner_id} className="hover:bg-surface-secondary/50">
                <Td>
                  {canWrite ? (
                    <div className="inline-flex gap-1">
                      <IconAction
                        label={`Subir ${banner.headline.split('\n')[0]}`}
                        onPress={() => move(index, -1)}
                        disabled={busy || index === 0}
                      >
                        <ArrowUp size={15} />
                      </IconAction>
                      <IconAction
                        label={`Descer ${banner.headline.split('\n')[0]}`}
                        onPress={() => move(index, 1)}
                        disabled={busy || index === rows.length - 1}
                      >
                        <ArrowDown size={15} />
                      </IconAction>
                    </div>
                  ) : (
                    index + 1
                  )}
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    {banner.image_url && (
                      // biome-ignore lint/performance/noImgElement: URL do bucket, sem otimização do Next
                      <img
                        src={banner.image_url}
                        alt=""
                        className="h-12 w-20 shrink-0 rounded-md border border-border bg-surface-secondary object-contain"
                      />
                    )}
                    <div>
                      <strong className="block">{banner.headline.replace('\n', ' · ')}</strong>
                      {banner.tag && <span className="muted block text-xs">{banner.tag}</span>}
                    </div>
                  </div>
                </Td>
                <Td className="text-xs">
                  <strong className="block">{banner.cta_label}</strong>
                  <span className="muted font-mono">{banner.href}</span>
                </Td>
                <Td className="text-xs">{windowOf(banner)}</Td>
                <Td>
                  <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
                </Td>
                <Td align="right">
                  {canWrite && (
                    <div className="inline-flex gap-2">
                      <IconAction
                        label={`${banner.is_active ? 'Desativar' : 'Ativar'} banner`}
                        onPress={() =>
                          run(() =>
                            updateBanner.mutateAsync({
                              banner_id: banner.banner_id,
                              body: { is_active: !banner.is_active },
                            })
                          )
                        }
                        disabled={busy}
                      >
                        <Power
                          size={16}
                          className={banner.is_active ? 'text-status-success' : 'text-muted'}
                        />
                      </IconAction>
                      <IconAction label="Editar banner" onPress={() => setFormTarget({ banner })}>
                        <Pencil size={16} />
                      </IconAction>
                      <IconAction
                        label="Apagar banner"
                        onPress={() => {
                          setActionError('');
                          setToDelete(banner);
                        }}
                        tone="danger"
                      >
                        <Trash2 size={16} />
                      </IconAction>
                    </div>
                  )}
                </Td>
              </Tr>
            );
          })}
          {data && rows.length === 0 && (
            <EmptyRow colSpan={6}>Nenhum banner. A loja mostra os dois padrões.</EmptyRow>
          )}
        </TBody>
      </AdminTable>
      <BannerForm target={formTarget} onClose={() => setFormTarget(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Apagar banner"
        confirmLabel="Apagar"
        onConfirm={() =>
          run(async () => {
            if (!toDelete) return;
            await deleteBanner.mutateAsync(toDelete.banner_id);
            setToDelete(null);
          })
        }
        isPending={deleteBanner.isPending}
        error={toDelete ? actionError : undefined}
      >
        Apagar o banner <strong>{toDelete?.headline.replace('\n', ' · ')}</strong>? Para só tirar do
        ar por um tempo, desative em vez de apagar.
      </ConfirmDialog>
    </div>
  );
}
