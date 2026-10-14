'use client';

import { type Banner, type BannerBody, bannerWindowIssue, isSafeHref } from '@geekstore/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Action, Dialog, FieldDate, FieldInput, FieldSwitch, FieldTextarea } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import { fromDateTimeLocal, toDateTimeLocal } from '../lib/format';
import { uploadImageToBucket } from '../lib/upload-image';
import { useCreateBanner, useUpdateBanner } from '../services/content/mutations';

const formSchema = z
  .object({
    tag: z.string().trim().max(120, 'No máximo 120 caracteres'),
    headline: z.string().trim().min(1, 'Informe o título').max(160, 'No máximo 160 caracteres'),
    text: z.string().trim().max(300, 'No máximo 300 caracteres'),
    cta_label: z.string().trim().min(1, 'Informe o texto do botão').max(60),
    href: z
      .string()
      .trim()
      .min(1, 'Informe o destino do botão')
      .refine(isSafeHref, 'Use um endereço da loja (/catalogo/) ou um link https://'),
    image_url: z.string(),
    starts_at: z.string(),
    ends_at: z.string(),
    is_active: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const issue = bannerWindowIssue({
      starts_at: fromDateTimeLocal(values.starts_at),
      ends_at: fromDateTimeLocal(values.ends_at),
    });
    if (issue) ctx.addIssue({ code: 'custom', path: ['ends_at'], message: issue });
  });
type FormValues = z.infer<typeof formSchema>;

const emptyValues: FormValues = {
  tag: '',
  headline: '',
  text: '',
  cta_label: '',
  href: '/catalogo/',
  image_url: '',
  starts_at: '',
  ends_at: '',
  is_active: true,
};

const fromBanner = (banner: Banner): FormValues => ({
  tag: banner.tag ?? '',
  headline: banner.headline,
  text: banner.text ?? '',
  cta_label: banner.cta_label,
  href: banner.href,
  image_url: banner.image_url ?? '',
  starts_at: toDateTimeLocal(banner.starts_at),
  ends_at: toDateTimeLocal(banner.ends_at),
  is_active: banner.is_active,
});

const toBody = (values: FormValues): BannerBody => ({
  tag: values.tag.trim() || null,
  headline: values.headline.trim(),
  text: values.text.trim() || null,
  cta_label: values.cta_label.trim(),
  href: values.href.trim(),
  image_url: values.image_url || null,
  starts_at: fromDateTimeLocal(values.starts_at),
  ends_at: fromDateTimeLocal(values.ends_at),
  is_active: values.is_active,
});

/** Imagem opcional: sobe para o bucket assim que é escolhida e guarda a URL no formulário. */
function ImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      onChange(await uploadImageToBucket(file));
    } catch (failure) {
      setError(getErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2">
      <span className="text-sm font-extrabold">Imagem (opcional)</span>
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-20 w-32 place-items-center overflow-hidden rounded-lg border border-border bg-surface-secondary">
          {value ? (
            // biome-ignore lint/performance/noImgElement: URL do bucket, sem otimização do Next
            <img src={value} alt="" className="size-full object-contain" />
          ) : (
            <span className="muted px-2 text-center text-xs">Sem imagem: aparece o mascote</span>
          )}
        </div>
        <label className="action action-outline cursor-pointer">
          <ImagePlus size={17} />
          {busy ? 'Enviando…' : value ? 'Trocar imagem' : 'Enviar imagem'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              pick(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </label>
        {value && (
          <Action onPress={() => onChange('')} disabled={busy} className="action-outline">
            <Trash2 size={17} /> Tirar
          </Action>
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

/** `{}` = novo banner; `{ banner }` = edição; `null` = fechado. */
export type BannerFormTarget = { banner?: Banner };

export function BannerForm({
  target,
  onClose,
}: {
  target: BannerFormTarget | null;
  onClose: () => void;
}) {
  const editing = target?.banner;
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const [formError, setFormError] = useState('');
  const defaults = useMemo(() => (editing ? fromBanner(editing) : emptyValues), [editing]);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), values: defaults });

  const submit = async (values: FormValues) => {
    setFormError('');
    const body = toBody(values);
    try {
      if (editing) await updateBanner.mutateAsync({ banner_id: editing.banner_id, body });
      else await createBanner.mutateAsync(body);
      onClose();
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Dialog
      open={target !== null}
      onChange={(open) => !open && onClose()}
      title={editing ? 'Editar banner' : 'Novo banner'}
      size="lg"
    >
      {target && (
        <form onSubmit={handleSubmit(submit)} className="grid gap-4" noValidate>
          <Controller
            control={control}
            name="tag"
            render={({ field, fieldState }) => (
              <FieldInput
                field={field}
                fieldState={fieldState}
                label="Chamada (texto pequeno no topo)"
                required={false}
                maxLength={120}
                placeholder="O próximo capítulo é seu"
              />
            )}
          />
          <Controller
            control={control}
            name="headline"
            render={({ field, fieldState }) => (
              <FieldTextarea
                field={field}
                fieldState={fieldState}
                label="Título"
                rows={2}
                maxLength={160}
                required
                description="Uma frase por linha: a primeira fica em branco, a segunda em amarelo."
              />
            )}
          />
          <Controller
            control={control}
            name="text"
            render={({ field, fieldState }) => (
              <FieldTextarea
                field={field}
                fieldState={fieldState}
                label="Texto de apoio"
                rows={2}
                maxLength={300}
              />
            )}
          />
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <Controller
              control={control}
              name="cta_label"
              render={({ field, fieldState }) => (
                <FieldInput
                  field={field}
                  fieldState={fieldState}
                  label="Texto do botão"
                  maxLength={60}
                />
              )}
            />
            <Controller
              control={control}
              name="href"
              render={({ field, fieldState }) => (
                <FieldInput
                  field={field}
                  fieldState={fieldState}
                  label="Para onde o botão leva"
                  description="Um endereço da loja (/catalogo/) ou um link https://"
                  maxLength={300}
                />
              )}
            />
          </div>
          <Controller
            control={control}
            name="image_url"
            render={({ field }) => <ImageField value={field.value} onChange={field.onChange} />}
          />
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            <Controller
              control={control}
              name="starts_at"
              render={({ field, fieldState }) => (
                <FieldDate field={field} fieldState={fieldState} label="Mostrar a partir de" />
              )}
            />
            <Controller
              control={control}
              name="ends_at"
              render={({ field, fieldState }) => (
                <FieldDate field={field} fieldState={fieldState} label="Mostrar até" />
              )}
            />
          </div>
          <Controller
            control={control}
            name="is_active"
            render={({ field, fieldState }) => (
              <FieldSwitch field={field} fieldState={fieldState} label="Banner ativo" />
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
