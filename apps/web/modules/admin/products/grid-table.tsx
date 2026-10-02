'use client';

import type { Attribute } from '@geekstore/shared';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { type Control, Controller, useWatch } from 'react-hook-form';

import { FieldInput, FieldNumber, FieldSwitch } from '@/components/ui';
import { describeAttributes } from '../lib/attribute-labels';
import { AdminTable, Td, Th } from '../ui/table';
import type { ProductFormValues } from './product-form-schema';

const BRL = { style: 'currency', currency: 'BRL' } as const;

/** As combinações da grade: um SKU por linha, com o essencial na linha e o resto em "detalhes". */
export function GridTable({
  control,
  rowIds,
  definitions,
  showCombination,
}: {
  control: Control<ProductFormValues>;
  rowIds: string[];
  definitions: Attribute[];
  /** Produto simples (1 SKU, sem grade) não precisa da coluna "Combinação". */
  showCombination: boolean;
}) {
  const rows = useWatch({ control, name: 'skus' });
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const columns = showCombination ? 8 : 7;

  return (
    <AdminTable>
      <thead>
        <tr>
          {showCombination && <Th>Combinação</Th>}
          <Th>Código do SKU</Th>
          <Th>EAN</Th>
          <Th>Peso (g)</Th>
          <Th>Preço</Th>
          <Th>Estoque inicial</Th>
          <Th>Ativo</Th>
          <Th align="right">
            <span className="sr-only">Detalhes</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {rowIds.map((id, index) => {
          const row = rows[index];
          if (!row) return null;
          const isExisting = Boolean(row.sku_id);
          const expanded = open.has(id);
          return (
            <GridRow
              key={id}
              control={control}
              index={index}
              isExisting={isExisting}
              expanded={expanded}
              columns={columns}
              showCombination={showCombination}
              combination={describeAttributes(row.attributes, definitions) || 'Único'}
              onToggle={() => toggle(id)}
            />
          );
        })}
      </tbody>
    </AdminTable>
  );
}

function GridRow({
  control,
  index,
  isExisting,
  expanded,
  columns,
  showCombination,
  combination,
  onToggle,
}: {
  control: Control<ProductFormValues>;
  index: number;
  isExisting: boolean;
  expanded: boolean;
  columns: number;
  showCombination: boolean;
  combination: string;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="align-top">
        {showCombination && (
          <Td className="min-w-[8rem] pt-5 font-extrabold whitespace-nowrap">{combination}</Td>
        )}
        <Td className="min-w-[13rem]">
          <Controller
            control={control}
            name={`skus.${index}.code`}
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="Código do SKU"
                hideLabel
                disabled={isExisting}
                maxLength={64}
              />
            )}
          />
        </Td>
        <Td className="min-w-[10rem]">
          <Controller
            control={control}
            name={`skus.${index}.ean`}
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="EAN/GTIN"
                hideLabel
                required={false}
                inputMode="numeric"
                maxLength={14}
              />
            )}
          />
        </Td>
        <Td className="min-w-[7rem]">
          <Controller
            control={control}
            name={`skus.${index}.weight_g`}
            render={({ field, fieldState }) => (
              <FieldNumber
                field={field}
                fieldState={fieldState}
                label="Peso (g)"
                hideLabel
                required={false}
                minValue={0}
              />
            )}
          />
        </Td>
        <Td className="min-w-[9rem]">
          {isExisting ? (
            <span className="muted block pt-3 text-xs">na grade de estoque</span>
          ) : (
            <Controller
              control={control}
              name={`skus.${index}.price`}
              render={({ field, fieldState }) => (
                <FieldNumber
                  field={field}
                  fieldState={fieldState}
                  label="Preço"
                  hideLabel
                  required={false}
                  minValue={0}
                  formatOptions={BRL}
                />
              )}
            />
          )}
        </Td>
        <Td className="min-w-[7rem]">
          {isExisting ? (
            <span className="muted block pt-3 text-xs">na grade de estoque</span>
          ) : (
            <Controller
              control={control}
              name={`skus.${index}.initial_stock`}
              render={({ field, fieldState }) => (
                <FieldNumber
                  field={field}
                  fieldState={fieldState}
                  label="Estoque inicial"
                  hideLabel
                  required={false}
                  minValue={0}
                />
              )}
            />
          )}
        </Td>
        <Td className="pt-3">
          <Controller
            control={control}
            name={`skus.${index}.status`}
            render={({ field, fieldState }) => (
              <FieldSwitch
                field={{
                  ...field,
                  value: field.value === 'active',
                  onChange: (isOn: boolean) => field.onChange(isOn ? 'active' : 'inactive'),
                }}
                fieldState={fieldState}
                label={field.value === 'active' ? 'Sim' : 'Não'}
              />
            )}
          />
        </Td>
        <Td align="right" className="pt-3">
          <button
            type="button"
            aria-expanded={expanded}
            aria-label="Mais campos do SKU"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border"
            onClick={onToggle}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </Td>
      </tr>
      {expanded && (
        <tr>
          <Td colSpan={columns} className="bg-surface-secondary/40">
            <div className="grid grid-cols-6 gap-4 max-tablet:grid-cols-3 max-md:grid-cols-2">
              <Controller
                control={control}
                name={`skus.${index}.manufacturer_code`}
                render={({ field, fieldState }) => (
                  <FieldInput
                    field={field}
                    fieldState={fieldState}
                    label="Código do fabricante"
                    required={false}
                    maxLength={60}
                  />
                )}
              />
              <Controller
                control={control}
                name={`skus.${index}.ncm`}
                render={({ field, fieldState }) => (
                  <FieldInput
                    field={field}
                    fieldState={fieldState}
                    label="NCM"
                    required={false}
                    inputMode="numeric"
                    maxLength={8}
                  />
                )}
              />
              {(
                [
                  ['length_mm', 'Comprimento (mm)'],
                  ['width_mm', 'Largura (mm)'],
                  ['height_mm', 'Altura (mm)'],
                ] as const
              ).map(([name, label]) => (
                <Controller
                  key={name}
                  control={control}
                  name={`skus.${index}.${name}`}
                  render={({ field, fieldState }) => (
                    <FieldNumber
                      field={field}
                      fieldState={fieldState}
                      label={label}
                      required={false}
                      minValue={0}
                    />
                  )}
                />
              ))}
              <Controller
                control={control}
                name={`skus.${index}.cost`}
                render={({ field, fieldState }) => (
                  <FieldNumber
                    field={field}
                    fieldState={fieldState}
                    label="Custo"
                    required={false}
                    minValue={0}
                    formatOptions={BRL}
                  />
                )}
              />
            </div>
          </Td>
        </tr>
      )}
    </>
  );
}
