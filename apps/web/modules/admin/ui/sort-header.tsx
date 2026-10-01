import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { Th } from './table';

/** Cabeçalho ordenável; `sort` é o valor da API (`campo:asc|desc`). */
export function SortHeader({
  label,
  field,
  sort,
  onSort,
  align,
}: {
  label: string;
  field: string;
  sort: string | null;
  onSort: (field: string) => void;
  align?: 'left' | 'right';
}) {
  const direction = sort === `${field}:asc` ? 'asc' : sort === `${field}:desc` ? 'desc' : null;
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <Th align={align}>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 font-extrabold uppercase"
        onClick={() => onSort(field)}
        aria-label={`Ordenar por ${label}`}
      >
        {label}
        <Icon size={13} className={direction ? 'text-foreground' : ''} />
      </button>
    </Th>
  );
}
