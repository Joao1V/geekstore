'use client';

import { Table } from '@heroui/react';
import type { ReactNode } from 'react';

type Align = 'left' | 'right';

const ALIGN: Record<Align, string> = { left: 'text-left', right: 'text-right' };

/** Tabela do admin sobre o `Table` do HeroUI (React Aria): rolagem horizontal e navegação por teclado. */
export function AdminTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Table variant="secondary" className="surface overflow-hidden">
      <Table.ScrollContainer>
        <Table.Content aria-label={label} className="min-w-160 text-sm">
          {children}
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

/** Cabeçalho: contém os `Th`. */
export function THead({ children }: { children: ReactNode }) {
  return <Table.Header>{children}</Table.Header>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <Table.Body>{children}</Table.Body>;
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <Table.Row className={className}>{children}</Table.Row>;
}

export function Th({
  children,
  align = 'left',
  isRowHeader = false,
}: {
  children?: ReactNode;
  align?: Align;
  isRowHeader?: boolean;
}) {
  return (
    <Table.Column
      isRowHeader={isRowHeader}
      className={`text-xs font-extrabold text-muted uppercase ${ALIGN[align]}`}
    >
      {children}
    </Table.Column>
  );
}

export function Td({
  children,
  align = 'left',
  className = '',
  colSpan,
}: {
  children?: ReactNode;
  align?: Align;
  className?: string;
  colSpan?: number;
}) {
  return (
    <Table.Cell colSpan={colSpan} className={`align-middle ${ALIGN[align]} ${className}`}>
      {children}
    </Table.Cell>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <Tr>
      <Td colSpan={colSpan} align="left" className="py-10 text-center text-muted">
        {children}
      </Td>
    </Tr>
  );
}
