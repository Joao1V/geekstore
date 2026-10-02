import type { CatalogDashboard, ProductIssue } from '@geekstore/shared';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { formatInteger } from '../lib/format';

type Check = {
  issue: ProductIssue;
  /** Nome do que está completo ("Fotos"). */
  label: string;
  /** O que falta, no singular/plural já resolvido ("sem foto"). */
  missing: string;
  /** Por que importa: o que quebra se faltar. */
  why: string;
};

// Ordem de gravidade: o que impede de vender primeiro, depois o que atrapalha.
const CHECKS: readonly Check[] = [
  { issue: 'no_price', label: 'Preço', missing: 'sem preço', why: 'não dá para vender' },
  { issue: 'no_photo', label: 'Fotos', missing: 'sem foto', why: 'vendem muito menos' },
  { issue: 'no_weight', label: 'Peso', missing: 'sem peso', why: 'o frete não é calculado' },
  { issue: 'no_brand', label: 'Marca', missing: 'sem marca', why: 'filtros e marketplaces pedem' },
  {
    issue: 'no_description',
    label: 'Descrição',
    missing: 'sem descrição',
    why: 'pior no Google e na conversão',
  },
];

const GOOD = 90;
const OK = 60;
const percent = (missing: number, total: number) =>
  total === 0 ? 100 : Math.round(((total - missing) / total) * 100);

function barColor(value: number): string {
  if (value >= GOOD) return 'bg-status-success';
  if (value >= OK) return 'bg-status-warning';
  return 'bg-status-error';
}

/**
 * Quão completo está o catálogo: uma barra por pendência, com o número de produtos que faltam e um
 * atalho para a lista já filtrada. A nota geral é a média das barras.
 */
export function CatalogHealth({ data }: { data: CatalogDashboard }) {
  const total = data.products.total;
  const rows = CHECKS.map((check) => {
    const missing = data.health[check.issue];
    return { ...check, value: percent(missing, total), text: check.missing };
  });
  const score = Math.round(rows.reduce((sum, row) => sum + row.value, 0) / rows.length);

  return (
    <section className="surface grid gap-5 p-6 max-md:p-4" aria-labelledby="catalog-health">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="catalog-health" className="text-xl font-extrabold">
            Saúde do catálogo
          </h2>
          <p className="muted text-sm">Quanto dos {formatInteger(total)} produtos está completo.</p>
        </div>
        <p className="font-display text-5xl leading-none tracking-wide tabular-nums">
          <span className="sr-only">Nota geral: </span>
          {score}
          <span className="muted text-2xl">/100</span>
        </p>
      </div>
      <ul className="grid gap-4">
        {rows.map((row) => {
          const missingCount = data.health[row.issue];
          return (
            <li key={row.issue} className="grid gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-extrabold">{row.label}</span>
                {missingCount === 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-status-success">
                    <CheckCircle2 size={15} aria-hidden="true" /> Tudo certo
                  </span>
                ) : (
                  <Link
                    href={`/admin/produtos/?issue=${row.issue}`}
                    className="group inline-flex items-center gap-1.5 text-sm font-extrabold hover:underline"
                  >
                    {formatInteger(missingCount)} {row.text}
                    <ArrowRight
                      size={14}
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                )}
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-surface-secondary"
                role="img"
                aria-label={`${row.label}: ${row.value}% completo`}
              >
                <div
                  className={`h-full rounded-full ${barColor(row.value)}`}
                  style={{ width: `${row.value}%` }}
                />
              </div>
              {missingCount > 0 && <p className="muted text-xs">{row.why}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
