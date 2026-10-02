'use client';

import {
  type Attribute,
  type CategoryAttribute,
  combinations,
  mergeGrid,
  suggestSkuCode,
} from '@geekstore/shared';
import { Copy } from 'lucide-react';
import { useEffect, useRef } from 'react';
import {
  Controller,
  type UseFieldArrayReturn,
  type UseFormReturn,
  useWatch,
} from 'react-hook-form';

import { Action, FieldSwitch } from '@/components/ui';
import { GridAxes } from './grid-axes';
import { GridTable } from './grid-table';
import { emptySku, type ProductFormValues } from './product-form-schema';

type Axes = ProductFormValues['axes'];
type SkuRow = ProductFormValues['skus'][number];

/**
 * SKUs do produto. Sem grade: um SKU só. Com grade: o lojista escolhe o que varia (cor, tamanho…) e os
 * valores de cada um, e o formulário gera uma linha por combinação, com o código já montado
 * (código do produto + sufixo de cada valor). SKU já gravado nunca some daqui.
 */
export function GridSection({
  form,
  skus,
  definitions,
  rules,
  isEditing,
}: {
  form: UseFormReturn<ProductFormValues>;
  skus: UseFieldArrayReturn<ProductFormValues, 'skus'>;
  definitions: Attribute[];
  rules: CategoryAttribute[];
  isEditing: boolean;
}) {
  const { control, setValue, getValues } = form;
  const hasGrid = useWatch({ control, name: 'has_grid' });
  const axes = useWatch({ control, name: 'axes' });
  const productCode = useWatch({ control, name: 'code' });
  const lockedGrid = isEditing && skus.fields.filter((row) => row.sku_id).length > 1;

  const gridDefinitions = definitions.map((definition) => ({
    code: definition.code,
    values: definition.values.map((value) => ({ code: value.code, sku_suffix: value.sku_suffix })),
  }));
  const axisOrder = (list: Axes) =>
    list.filter((axis) => axis.attribute && axis.values.length > 0).map((axis) => axis.attribute);
  const codeFor = (code: string, attributes: Record<string, string>, list: Axes) =>
    suggestSkuCode(code, attributes, axisOrder(list), gridDefinitions);

  /** Recalcula as linhas a partir dos eixos: mantém o digitado, acrescenta o que falta. */
  const syncRows = (nextAxes: Axes) => {
    const wanted = combinations(nextAxes);
    const current = getValues('skus');
    const merged = mergeGrid(
      current,
      wanted,
      (attributes): SkuRow => ({
        ...emptySku(),
        attributes,
        code: codeFor(getValues('code'), attributes, nextAxes),
      })
    );
    skus.replace(merged);
  };

  const setAxes = (next: Axes) => {
    setValue('axes', next, { shouldDirty: true });
    syncRows(next);
  };

  // O código do produto muda (cadastro novo): os SKUs novos cujo código ainda é o sugerido acompanham.
  const previousCode = useRef(productCode);
  // biome-ignore lint/correctness/useExhaustiveDependencies: só reage à troca do código do produto
  useEffect(() => {
    const before = previousCode.current;
    previousCode.current = productCode;
    if (before === productCode) return;
    getValues('skus').forEach((row, index) => {
      if (row.sku_id) return;
      const wasSuggested = row.code === codeFor(before, row.attributes, getValues('axes'));
      if (wasSuggested || row.code === '') {
        setValue(`skus.${index}.code`, codeFor(productCode, row.attributes, getValues('axes')));
      }
    });
  }, [productCode]);

  const toggleGrid = (next: boolean) => {
    setValue('has_grid', next, { shouldDirty: true });
    if (next) {
      const required = rules.filter((rule) => rule.is_required).map((rule) => rule.code);
      const initial: Axes = (required.length ? required : ['']).map((attribute) => ({
        attribute,
        values: [],
      }));
      setValue('axes', axes.length ? axes : initial, { shouldDirty: true });
      return;
    }
    // Volta ao SKU único: fica a primeira linha, sem atributos.
    setValue('axes', [], { shouldDirty: true });
    const [first] = getValues('skus');
    skus.replace([
      { ...(first ?? emptySku()), attributes: {}, code: first?.code || getValues('code') },
    ]);
  };

  const repeatFirstRow = () => {
    const rows = getValues('skus');
    const [first] = rows;
    if (!first) return;
    rows.forEach((row, index) => {
      if (index === 0 || row.sku_id) return;
      setValue(`skus.${index}.price`, first.price, { shouldDirty: true });
      setValue(`skus.${index}.initial_stock`, first.initial_stock, { shouldDirty: true });
      setValue(`skus.${index}.weight_g`, first.weight_g, { shouldDirty: true });
    });
  };

  const rowIds = skus.fields.map((row) => row.id);
  const hasNewRows = skus.fields.some((row) => !row.sku_id);

  return (
    <div className="grid gap-5">
      <Controller
        control={control}
        name="has_grid"
        render={({ field, fieldState }) => (
          <FieldSwitch
            field={{ ...field, onChange: toggleGrid }}
            fieldState={fieldState}
            label={
              lockedGrid
                ? 'Produto com grade (já tem várias variações)'
                : 'Produto com grade (cor, tamanho…)'
            }
          />
        )}
      />
      {hasGrid && (
        <GridAxes
          control={control}
          axes={axes}
          definitions={definitions}
          onAttributeChange={(index, attribute) =>
            setAxes(axes.map((axis, i) => (i === index ? { attribute, values: [] } : axis)))
          }
          onToggleValue={(index, valueCode) =>
            setAxes(
              axes.map((axis, i) =>
                i !== index
                  ? axis
                  : {
                      ...axis,
                      values: axis.values.includes(valueCode)
                        ? axis.values.filter((value) => value !== valueCode)
                        : [...axis.values, valueCode],
                    }
              )
            )
          }
          onAddAxis={() => setValue('axes', [...axes, { attribute: '', values: [] }])}
          onRemoveAxis={(index) => setAxes(axes.filter((_, i) => i !== index))}
        />
      )}
      {hasGrid && skus.fields.length === 0 && (
        <p className="muted text-sm">Marque ao menos um valor para gerar os SKUs.</p>
      )}
      {skus.fields.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-extrabold">
              {hasGrid
                ? `${skus.fields.length} ${skus.fields.length === 1 ? 'SKU' : 'SKUs'} (um por combinação)`
                : 'SKU'}
            </p>
            {hasGrid && hasNewRows && skus.fields.length > 1 && (
              <Action className="action-outline" onPress={repeatFirstRow}>
                <Copy size={16} /> Repetir preço, estoque e peso da 1ª linha
              </Action>
            )}
          </div>
          <GridTable
            control={control}
            rowIds={rowIds}
            definitions={definitions}
            showCombination={hasGrid}
          />
        </>
      )}
    </div>
  );
}
