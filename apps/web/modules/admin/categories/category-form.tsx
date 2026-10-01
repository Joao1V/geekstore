'use client';

import type { Category, CategoryBody } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, Dialog, FieldInput, FieldNumber, FieldSwitch } from '@/components/ui';
import {
  type CategoryNode,
  flattenTree,
  MAX_CATEGORY_DEPTH,
  subtreeHeight,
  subtreeIds,
} from '../lib/category-tree';
import { getErrorMessage } from '../lib/errors';
import { emptyToNull, slugify } from '../lib/format';
import { useCreateCategory, useUpdateCategory } from '../services/catalog/mutations';
import { CategoryAutocomplete } from './category-autocomplete';

const ROOT = 'root';
const ROOT_OPTIONS = [{ value: ROOT, label: 'Nenhuma (categoria raiz)' }];

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(255),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use minúsculas, números e hífens'),
  parent_id: z.string(),
  featured: z.boolean(),
  position: z.number().int('Use um número inteiro').min(0, 'Não pode ser negativo').nullable(),
  seo_title: z.string().max(255),
  seo_description: z.string().max(500),
  canonical_url: z.string().refine((value) => !value || URL.canParse(value), 'URL inválida'),
});
type CategoryFormValues = z.infer<typeof categoryFormSchema>;

function toBody(values: CategoryFormValues): CategoryBody {
  return {
    parent_id: values.parent_id === ROOT ? null : values.parent_id,
    name: values.name.trim(),
    slug: values.slug,
    featured: values.featured,
    position: values.position ?? 0,
    seo_title: emptyToNull(values.seo_title),
    seo_description: emptyToNull(values.seo_description),
    canonical_url: emptyToNull(values.canonical_url),
  };
}

export type CategoryFormTarget = { category?: Category; parentId?: string };

export function CategoryForm({
  target,
  tree,
  onClose,
}: {
  target: CategoryFormTarget | null;
  tree: CategoryNode[];
  onClose: () => void;
}) {
  const editing = target?.category;
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const [formError, setFormError] = useState('');

  const defaults = useMemo<CategoryFormValues>(
    () => ({
      name: editing?.name ?? '',
      slug: editing?.slug ?? '',
      parent_id: editing ? (editing.parent_id ?? ROOT) : (target?.parentId ?? ROOT),
      featured: editing?.featured ?? false,
      position: editing?.position ?? 0,
      seo_title: editing?.seo_title ?? '',
      seo_description: editing?.seo_description ?? '',
      canonical_url: editing?.canonical_url ?? '',
    }),
    [editing, target?.parentId]
  );

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting, dirtyFields },
  } = useForm<CategoryFormValues>({ resolver: zodResolver(categoryFormSchema), values: defaults });

  // O pai não pode ser a própria categoria, uma descendente, nem estourar os 3 níveis.
  const isParentAllowed = useMemo(() => {
    const self = editing
      ? flattenTree(tree).find((node) => node.category.category_id === editing.category_id)
      : null;
    const blocked = editing ? subtreeIds(tree, editing.category_id) : new Set<string>();
    const height = self ? subtreeHeight(self) : 1;
    return (node: CategoryNode) =>
      !blocked.has(node.category.category_id) && node.depth + height <= MAX_CATEGORY_DEPTH;
  }, [tree, editing]);

  const submit = async (values: CategoryFormValues) => {
    setFormError('');
    try {
      if (editing) {
        await updateCategory.mutateAsync({
          category_id: editing.category_id,
          body: toBody(values),
        });
      } else {
        await createCategory.mutateAsync(toBody(values));
      }
      onClose();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Dialog
      open={target !== null}
      onChange={(open) => !open && onClose()}
      title={editing ? 'Editar categoria' : 'Nova categoria'}
      size="lg"
    >
      {target && (
        <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <FieldInput
                field={{
                  ...field,
                  onChange: (event) => {
                    field.onChange(event);
                    if (!editing && !dirtyFields.slug)
                      setValue('slug', slugify(event.target.value));
                  },
                }}
                fieldState={fieldState}
                label="Nome"
              />
            )}
          />
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <Controller
              control={control}
              name="slug"
              render={({ field, fieldState }) => (
                <FieldInput field={field} fieldState={fieldState} label="Slug" />
              )}
            />
            <Controller
              control={control}
              name="parent_id"
              render={({ field, fieldState }) => (
                <CategoryAutocomplete
                  field={field}
                  fieldState={fieldState}
                  label="Categoria pai"
                  description="A árvore vai até 3 níveis."
                  required={false}
                  leadingOptions={ROOT_OPTIONS}
                  isOptionAllowed={isParentAllowed}
                />
              )}
            />
          </div>
          <div className="grid grid-cols-2 items-start gap-4 max-md:grid-cols-1">
            <Controller
              control={control}
              name="position"
              render={({ field, fieldState }) => (
                <FieldNumber
                  field={field}
                  fieldState={fieldState}
                  label="Posição"
                  minValue={0}
                  description="Menor aparece primeiro."
                />
              )}
            />
            <Controller
              control={control}
              name="featured"
              render={({ field, fieldState }) => (
                <FieldSwitch
                  field={field}
                  fieldState={fieldState}
                  heading="Exibição"
                  label="Destaque na home"
                />
              )}
            />
          </div>
          <Controller
            control={control}
            name="seo_title"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="SEO: título"
                required={false}
              />
            )}
          />
          <Controller
            control={control}
            name="seo_description"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="SEO: descrição"
                required={false}
              />
            )}
          />
          <Controller
            control={control}
            name="canonical_url"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="SEO: URL canônica"
                required={false}
                placeholder="https://"
              />
            )}
          />
          {formError && (
            <p className="error m-0" role="alert">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Action className="action-outline" onPress={onClose}>
              Cancelar
            </Action>
            <Action type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </Action>
          </div>
        </form>
      )}
    </Dialog>
  );
}
