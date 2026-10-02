'use client';

import type { Attribute } from '@geekstore/shared';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { type Control, Controller } from 'react-hook-form';

import { Action, FieldSelect } from '@/components/ui';
import type { ProductFormValues } from './product-form-schema';

const MAX_AXES = 4;

type Props = {
  control: Control<ProductFormValues>;
  axes: ProductFormValues['axes'];
  definitions: Attribute[];
  onAttributeChange: (index: number, attribute: string) => void;
  onToggleValue: (index: number, valueCode: string) => void;
  onAddAxis: () => void;
  onRemoveAxis: (index: number) => void;
};

/** "O que varia neste produto": para cada atributo escolhido, marque os valores que existem. */
export function GridAxes({
  control,
  axes,
  definitions,
  onAttributeChange,
  onToggleValue,
  onAddAxis,
  onRemoveAxis,
}: Props) {
  const usedElsewhere = (index: number) =>
    new Set(axes.flatMap((axis, i) => (i !== index && axis.attribute ? [axis.attribute] : [])));

  return (
    <div className="grid gap-4 rounded-2xl border border-border p-4">
      <p className="text-sm font-extrabold">O que varia neste produto</p>
      {axes.map((axis, index) => {
        const taken = usedElsewhere(index);
        const attribute = definitions.find((definition) => definition.code === axis.attribute);
        const options = definitions
          .filter((definition) => definition.is_active && !taken.has(definition.code))
          .map((definition) => ({ value: definition.code, label: definition.name }));
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: a posição é a identidade do eixo no formulário
            key={index}
            className="grid grid-cols-[14rem_1fr_auto] items-start gap-4 max-md:grid-cols-1"
          >
            <Controller
              control={control}
              name={`axes.${index}.attribute`}
              render={({ field, fieldState }) => (
                <FieldSelect
                  field={{ ...field, onChange: (value) => onAttributeChange(index, String(value)) }}
                  fieldState={fieldState}
                  label="Atributo"
                  required={false}
                  placeholder="Escolha…"
                  options={options}
                />
              )}
            />
            <div className="grid gap-2">
              <span className="text-sm font-extrabold">Valores</span>
              {attribute ? (
                <div className="flex max-h-40 flex-wrap gap-2 overflow-auto p-0.5">
                  {attribute.values
                    .filter((value) => value.is_active || axis.values.includes(value.code))
                    .map((value) => {
                      const selected = axis.values.includes(value.code);
                      return (
                        <button
                          key={value.attribute_value_id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onToggleValue(index, value.code)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-extrabold transition-colors ${
                            selected
                              ? 'border-geek-yellow bg-geek-yellow text-ink'
                              : 'border-border bg-surface hover:border-ink'
                          }`}
                        >
                          {value.color_hex && (
                            <span
                              aria-hidden="true"
                              className="size-3 rounded-full border border-border"
                              style={{ backgroundColor: value.color_hex }}
                            />
                          )}
                          {value.label}
                        </button>
                      );
                    })}
                </div>
              ) : (
                <p className="muted text-sm">Escolha um atributo para ver os valores.</p>
              )}
              {attribute && (
                <Link href="/admin/atributos/" className="muted w-max text-xs underline">
                  Falta um valor? Cadastre em Atributos
                </Link>
              )}
            </div>
            <button
              type="button"
              aria-label="Remover atributo da grade"
              className="mt-7 flex size-10 items-center justify-center rounded-lg border border-border"
              onClick={() => onRemoveAxis(index)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}
      {axes.length < MAX_AXES && (
        <Action className="action-outline w-max" onPress={onAddAxis}>
          <Plus size={16} /> Adicionar atributo
        </Action>
      )}
    </div>
  );
}
