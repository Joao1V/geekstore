'use client';

import type { Media } from '@geekstore/shared';
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Action, FieldInput } from '@/components/ui';
import { getErrorMessage } from '../lib/errors';
import {
  useDeleteMedia,
  useUpdateMedia,
  useUploadProductImage,
} from '../services/catalog/mutations';

function AltForm({ media, canWrite }: { media: Media; canWrite: boolean }) {
  const updateMedia = useUpdateMedia();
  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<{ alt: string }>({ values: { alt: media.alt } });

  const submit = handleSubmit(({ alt }) =>
    updateMedia.mutateAsync({ media_id: media.media_id, body: { alt } }).catch(() => undefined)
  );

  return (
    <form onSubmit={submit} className="grid gap-2">
      <Controller
        control={control}
        name="alt"
        rules={{ required: 'Descreva a imagem', maxLength: 255 }}
        render={({ field, fieldState }) => (
          <FieldInput field={field} fieldState={fieldState} label="Texto alternativo" />
        )}
      />
      {canWrite && isDirty && (
        <Action type="submit" className="action-outline w-max" disabled={updateMedia.isPending}>
          Salvar texto
        </Action>
      )}
      {updateMedia.isError && (
        <p className="error m-0" role="alert">
          {getErrorMessage(updateMedia.error)}
        </p>
      )}
    </form>
  );
}

export function ProductImages({
  productId,
  productName,
  media,
  canWrite,
}: {
  productId: string;
  productName: string;
  media: Media[];
  canWrite: boolean;
}) {
  const upload = useUploadProductImage();
  const updateMedia = useUpdateMedia();
  const deleteMedia = useDeleteMedia();
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const sorted = [...media].sort((a, b) => a.position - b.position);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setMessage(null);
    let nextPosition = sorted.length;
    const failures: string[] = [];
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync({
          product_id: productId,
          file,
          alt: productName,
          position: nextPosition,
        });
        nextPosition += 1;
      } catch (error) {
        failures.push(`${file.name}: ${getErrorMessage(error)}`);
      }
    }
    setMessage(
      failures.length
        ? { tone: 'error', text: failures.join(' ') }
        : { tone: 'info', text: 'Imagens enviadas. Ajuste o texto alternativo de cada uma.' }
    );
  };

  const move = async (from: number, to: number) => {
    if (to < 0 || to >= sorted.length) return;
    const reordered = [...sorted];
    const [item] = reordered.splice(from, 1);
    if (!item) return;
    reordered.splice(to, 0, item);
    setMessage(null);
    try {
      for (const [position, entry] of reordered.entries()) {
        if (entry.position !== position) {
          await updateMedia.mutateAsync({ media_id: entry.media_id, body: { position } });
        }
      }
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    }
  };

  const remove = async (mediaId: string) => {
    setMessage(null);
    try {
      await deleteMedia.mutateAsync(mediaId);
    } catch (error) {
      setMessage({ tone: 'error', text: getErrorMessage(error) });
    }
  };

  return (
    <section className="surface grid gap-5 p-6 max-md:p-4" aria-labelledby="product-images">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="product-images" className="text-xl font-extrabold">
          Imagens
        </h2>
        {canWrite && (
          <label className="action action-outline cursor-pointer">
            <ImagePlus size={17} />
            {upload.isPending ? 'Enviando…' : 'Enviar imagens'}
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={upload.isPending}
              onChange={(event) => {
                handleFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      <p className="muted text-sm">
        As imagens são comprimidas no navegador (WebP/JPEG, até 5 MB) antes do envio. A primeira é a
        capa.
      </p>
      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={message.tone === 'error' ? 'error m-0' : 'notice m-0'}
        >
          {message.text}
        </p>
      )}
      {!sorted.length && <p className="muted text-sm">Nenhuma imagem ainda.</p>}
      <ul className="grid gap-4">
        {sorted.map((item, index) => (
          <li
            key={item.media_id}
            className="grid grid-cols-[120px_1fr_auto] items-start gap-4 max-md:grid-cols-[80px_1fr]"
          >
            {/* biome-ignore lint/performance/noImgElement: URL do bucket, sem otimização do Next */}
            <img
              src={item.url}
              alt={item.alt}
              width={120}
              height={120}
              className="size-[120px] rounded-xl border border-border bg-surface-secondary object-cover max-md:size-20"
            />
            <AltForm media={item} canWrite={canWrite} />
            {canWrite && (
              <div className="flex gap-2 max-md:col-span-2">
                <button
                  type="button"
                  aria-label="Mover para cima"
                  className="flex size-9 items-center justify-center rounded-lg border border-border disabled:opacity-40"
                  disabled={index === 0 || updateMedia.isPending}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Mover para baixo"
                  className="flex size-9 items-center justify-center rounded-lg border border-border disabled:opacity-40"
                  disabled={index === sorted.length - 1 || updateMedia.isPending}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Excluir imagem"
                  className="flex size-9 items-center justify-center rounded-lg border border-border text-status-error"
                  disabled={deleteMedia.isPending}
                  onClick={() => remove(item.media_id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
