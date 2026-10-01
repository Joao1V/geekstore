'use client';

import type { Collection, CollectionBody } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Action,
  Dialog,
  FieldInput,
  FieldNumber,
  FieldSelect,
  FieldSwitch,
  FieldTextarea,
} from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { emptyToNull, slugify } from '../lib/format';
import { useCreateCollection, useUpdateCollection } from '../services/catalog/mutations';

export const COLLECTION_KIND_OPTIONS = [
  { value: 'franchise', label: 'Franquia (Star Wars, Marvel…)' },
  { value: 'curated', label: 'Curadoria manual (Novos Drops…)' },
];

const collectionFormSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(255),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use minúsculas, números e hífens'),
  kind: z.enum(['franchise', 'curated']),
  description: z.string().max(20000),
  featured: z.boolean(),
  position: z.number().int('Use um número inteiro').min(0, 'Não pode ser negativo').nullable(),
});
type CollectionFormValues = z.infer<typeof collectionFormSchema>;

function toBody(values: CollectionFormValues): CollectionBody {
  return {
    name: values.name.trim(),
    slug: values.slug,
    kind: values.kind,
    description: emptyToNull(values.description),
    featured: values.featured,
    position: values.position ?? 0,
  };
}

/** `target` `{}` = nova coleção; `{ collection }` = edição; `null` = fechado. */
export type CollectionFormTarget = { collection?: Collection };

export function CollectionForm({
  target,
  onClose,
}: {
  target: CollectionFormTarget | null;
  onClose: () => void;
}) {
  const editing = target?.collection;
  const createCollection = useCreateCollection();
  const updateCollection = useUpdateCollection();
  const [formError, setFormError] = useState('');

  const defaults = useMemo<CollectionFormValues>(
    () => ({
      name: editing?.name ?? '',
      slug: editing?.slug ?? '',
      kind: editing?.kind ?? 'franchise',
      description: editing?.description ?? '',
      featured: editing?.featured ?? false,
      position: editing?.position ?? 0,
    }),
    [editing]
  );

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting, dirtyFields },
  } = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionFormSchema),
    values: defaults,
  });

  const submit = async (values: CollectionFormValues) => {
    setFormError('');
    try {
      if (editing) {
        await updateCollection.mutateAsync({
          collection_id: editing.collection_id,
          body: toBody(values),
        });
      } else {
        await createCollection.mutateAsync(toBody(values));
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
      title={editing ? 'Editar coleção' : 'Nova coleção'}
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
          <Controller
            control={control}
            name="slug"
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Slug" />
            )}
          />
          <Controller
            control={control}
            name="kind"
            render={({ field, fieldState }) => (
              <FieldSelect
                field={field}
                fieldState={fieldState}
                label="Tipo"
                options={COLLECTION_KIND_OPTIONS}
              />
            )}
          />
          <Controller
            control={control}
            name="description"
            render={({ field, fieldState }) => (
              <FieldTextarea field={field} fieldState={fieldState} label="Descrição" rows={3} />
            )}
          />
          <div className="grid grid-cols-2 items-start gap-4 max-md:grid-cols-1">
            <Controller
              control={control}
              name="position"
              render={({ field, fieldState }) => (
                <FieldNumber field={field} fieldState={fieldState} label="Posição" minValue={0} />
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
