'use client';

import type { Brand } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, Dialog, FieldInput, FieldSwitch } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { useCreateBrand, useUpdateBrand } from '../services/catalog/mutations';

const formSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(120),
  is_active: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

/** `{}` = nova marca; `{ brand }` = edição; `null` = fechado. */
export type BrandFormTarget = { brand?: Brand };

export function BrandForm({
  target,
  onClose,
}: {
  target: BrandFormTarget | null;
  onClose: () => void;
}) {
  const editing = target?.brand;
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const [formError, setFormError] = useState('');

  const defaults = useMemo<FormValues>(
    () => ({ name: editing?.name ?? '', is_active: editing?.is_active ?? true }),
    [editing]
  );
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), values: defaults });

  const submit = async (values: FormValues) => {
    setFormError('');
    try {
      if (editing) {
        await updateBrand.mutateAsync({
          brand_id: editing.brand_id,
          body: { name: values.name.trim(), is_active: values.is_active },
        });
      } else {
        await createBrand.mutateAsync({ name: values.name.trim() });
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
      title={editing ? 'Editar marca' : 'Nova marca'}
    >
      {target && (
        <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <FieldInput field={field} fieldState={fieldState} label="Nome da marca" />
            )}
          />
          {editing && (
            <Controller
              control={control}
              name="is_active"
              render={({ field, fieldState }) => (
                <FieldSwitch
                  field={field}
                  fieldState={fieldState}
                  heading="Situação"
                  label="Ativa"
                />
              )}
            />
          )}
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
