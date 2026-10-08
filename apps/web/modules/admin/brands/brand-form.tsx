'use client';

import type { Brand } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, Dialog, FieldInput, FieldSwitch } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { useCreateBrand, useUpdateBrand, useUploadBrandLogo } from '../services/catalog/mutations';
import { brandsQueryOptions } from '../services/catalog/queries';

const formSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome').max(120),
  is_active: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

/** Logo da marca: envia (comprime no navegador) ou remove, e salva na hora, sem esperar o "Salvar". */
function LogoField({ brand }: { brand: Brand }) {
  // Lê da lista (invalidada após o envio) para a prévia atualizar; o `brand` do alvo é um retrato antigo.
  const { data: brands } = useQuery(brandsQueryOptions());
  const logoUrl = (brands ?? []).find((b) => b.brand_id === brand.brand_id)?.logo_url ?? null;
  const upload = useUploadBrandLogo();
  const update = useUpdateBrand();
  const [error, setError] = useState('');
  const busy = upload.isPending || update.isPending;

  const send = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      await upload.mutateAsync({ brand_id: brand.brand_id, file });
    } catch (failure) {
      setError(getErrorMessage(failure));
    }
  };
  const remove = async () => {
    setError('');
    try {
      await update.mutateAsync({ brand_id: brand.brand_id, body: { logo_url: null } });
    } catch (failure) {
      setError(getErrorMessage(failure));
    }
  };

  return (
    <div className="grid gap-2">
      <span className="text-sm font-extrabold">Logo</span>
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-32 place-items-center rounded-lg border border-border bg-surface-secondary p-2">
          {logoUrl ? (
            // biome-ignore lint/performance/noImgElement: URL do bucket, sem otimização do Next
            <img src={logoUrl} alt={`Logo ${brand.name}`} className="max-h-full object-contain" />
          ) : (
            <span className="muted text-xs">Sem logo</span>
          )}
        </div>
        <label className="action action-outline cursor-pointer">
          <ImagePlus size={17} />
          {upload.isPending ? 'Enviando…' : logoUrl ? 'Trocar logo' : 'Enviar logo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              send(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        {logoUrl && (
          <button type="button" className="action action-outline" disabled={busy} onClick={remove}>
            <Trash2 size={17} /> Remover
          </button>
        )}
      </div>
      {error && (
        <p className="error m-0 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

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
          {editing && <LogoField brand={editing} />}
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
