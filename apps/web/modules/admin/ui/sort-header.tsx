import { Button } from '@heroui/react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { Th } from './table';

/** Cabeçalho ordenável; `sort` é o valor da API (`campo:asc|desc`). */
export function SortHeader({
  label,
  field,
  sort,
  onSort,
  align,
  isRowHeader,
}: {
  label: string;
  field: string;
  sort: string | null;
  onSort: (field: string) => void;
  align?: 'left' | 'right';
  isRowHeader?: boolean;
}) {
  const direction = sort === `${field}:asc` ? 'asc' : sort === `${field}:desc` ? 'desc' : null;
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <Th align={align} isRowHeader={isRowHeader}>
      <Button
        variant="ghost"
        className="h-auto min-w-0 gap-1.5 p-0 text-xs font-extrabold uppercase"
        onPress={() => onSort(field)}
        aria-label={`Ordenar por ${label}`}
      >
        {label}
        <Icon size={13} className={direction ? 'text-foreground' : ''} />
      </Button>
    </Th>
  );
}
