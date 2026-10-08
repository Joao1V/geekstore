'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Action } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { formatInteger } from '../lib/format';
import { useCan } from '../lib/use-can';
import { useUrlState } from '../lib/use-url-state';
import { useMergeCertainDuplicates } from '../services/catalog/mutations';
import {
  duplicateGroupsQueryOptions,
  duplicateSummaryQueryOptions,
} from '../services/catalog/queries';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { type FilterChip, FilterChips } from '../ui/filter-chips';
import { PageHeader } from '../ui/page-header';
import { PaginationBar } from '../ui/pagination-bar';
import { DuplicateGroupCard } from './duplicate-group-card';

const PAGE_SIZE = 10;
type LevelParam = 'certain' | 'likely' | 'review';
const LEVELS: readonly LevelParam[] = ['certain', 'likely', 'review'];

/** Central de duplicados: a mesclagem em lote dos "certeza" no topo, e a revisão dos demais grupos. */
export function DuplicateCenter() {
  const canWrite = useCan('catalog:write');
  const { searchParams, setParams, page } = useUrlState();
  const levelParam = searchParams.get('nivel');
  const level = LEVELS.find((value) => value === levelParam) ?? 'certain';

  const { data: summary } = useQuery(duplicateSummaryQueryOptions());
  const { data, isPending, error } = useQuery(
    duplicateGroupsQueryOptions({ level, page, page_size: PAGE_SIZE })
  );

  const bulk = useMergeCertainDuplicates();
  const [confirming, setConfirming] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');
  const preview = bulk.data?.dry_run ? bulk.data : null;

  const openConfirm = async () => {
    setDoneMessage('');
    setConfirming(true);
    await bulk.mutateAsync(true).catch(() => undefined);
  };
  const confirmBulk = async () => {
    const result = await bulk.mutateAsync(false).catch(() => null);
    if (!result) return;
    setConfirming(false);
    setDoneMessage(
      `${formatInteger(result.groups)} grupos mesclados: ${formatInteger(result.skus_archived)} duplicatas arquivadas e ${formatInteger(result.units_moved)} unidades somadas.` +
        (result.skipped.length
          ? ` ${result.skipped.length} grupo(s) ficaram de fora (ex.: unidades reservadas).`
          : '')
    );
  };

  const chips: FilterChip[] = [
    { id: 'certain', label: 'Certeza', count: summary?.certain },
    { id: 'likely', label: 'Provável', count: summary?.likely },
    { id: 'review', label: 'Revisar', count: summary?.review },
  ];

  return (
    <>
      <PageHeader
        title="Produtos duplicados"
        crumbs={[{ label: 'Catálogo' }, { label: 'Duplicados' }]}
      />
      <p className="muted mb-5 max-w-3xl text-sm">
        O ERP cadastrou o mesmo produto mais de uma vez. Mesclar mantém um produto e soma o estoque
        dele (registrado no histórico); o código do ERP do repetido é guardado. O mesmo código de
        barras sozinho <strong>não</strong> indica duplicata: o ERP usa um só código para séries
        inteiras.
      </p>
      {doneMessage && (
        <p className="notice mb-4 flex items-center gap-2" role="status">
          <CheckCircle2 size={17} aria-hidden="true" /> {doneMessage}
        </p>
      )}
      {canWrite && summary && summary.certain > 0 && (
        <section className="surface mb-6 flex flex-wrap items-center justify-between gap-4 border-geek-yellow p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <Sparkles size={19} aria-hidden="true" /> {formatInteger(summary.certain)} grupos com
              certeza
            </h2>
            <p className="muted text-sm">
              Mesmo nome, mesmo código de barras e mesmo preço. Resolva todos de uma vez, com
              prévia.
            </p>
          </div>
          <Action onPress={openConfirm}>Mesclar todos os “certeza”</Action>
        </section>
      )}
      <FilterChips
        label="Nível de confiança"
        chips={chips}
        active={level}
        onSelect={(id) => setParams({ nivel: id })}
      />
      {error && (
        <p className="error" role="alert">
          {getErrorMessage(error)}
        </p>
      )}
      {isPending && <p className="muted">Procurando duplicados…</p>}
      <div className="grid gap-4">
        {data?.data.map((group) => (
          <DuplicateGroupCard key={group.key} group={group} canWrite={canWrite} />
        ))}
      </div>
      {data && data.data.length === 0 && (
        <p className="surface muted p-8 text-center">
          {level === 'certain'
            ? 'Nenhum duplicado com certeza. Catálogo limpo!'
            : 'Nada para revisar neste nível.'}
        </p>
      )}
      {data && (
        <PaginationBar meta={data.meta} onPage={(next) => setParams({ page: next }, false)} />
      )}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Mesclar todos os “certeza”"
        confirmLabel="Mesclar tudo"
        onConfirm={confirmBulk}
        isPending={bulk.isPending}
        error={bulk.error ? getErrorMessage(bulk.error) : undefined}
      >
        {preview ? (
          <>
            <p>
              Serão mesclados <strong>{formatInteger(preview.groups)} grupos</strong>:{' '}
              <strong>{formatInteger(preview.skus_archived)} produtos repetidos</strong> serão
              arquivados e <strong>{formatInteger(preview.units_moved)} unidades</strong> de estoque
              passam para o produto que fica (o que tem foto; se empatar, o cadastro mais antigo).
            </p>
            <p className="muted mt-2">
              Tudo fica registrado no histórico de estoque e o código do ERP de cada repetido é
              guardado. Grupos com unidades reservadas são pulados.
            </p>
          </>
        ) : (
          <p className="muted">Calculando a prévia…</p>
        )}
      </ConfirmDialog>
    </>
  );
}
