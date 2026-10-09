'use client';

import type { ProductDetail } from '@geekstore/shared';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { useState } from 'react';

import { Dialog } from '@/components/ui';
import { useCan } from '../lib/use-can';
import { ProductImages } from './product-images';

const ICON_BUTTON =
  'grid size-9 place-items-center rounded-full bg-night/75 text-night-fg shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-colors hover:bg-night focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * Foto do produto no card lateral: com mais de uma imagem vira carrossel (setas e pontos), e o
 * lápis flutuante abre o gerenciador de imagens num modal.
 */
export function ProductGallery({ product }: { product: ProductDetail }) {
  const canWrite = useCan('catalog:write');
  const [requested, setRequested] = useState(0);
  const [editing, setEditing] = useState(false);

  const images = [...product.media].sort((a, b) => a.position - b.position);
  // Apagar imagens no modal pode deixar o índice além do fim: deriva em vez de guardar corrigido.
  const index = Math.min(requested, Math.max(images.length - 1, 0));
  const current = images[index];
  const hasMany = images.length > 1;

  const go = (step: number) => setRequested((index + step + images.length) % images.length);

  return (
    <>
      <section
        aria-roledescription="carrossel"
        aria-label={`Fotos de ${product.name}`}
        className="relative grid aspect-square place-items-center overflow-hidden rounded-xl border border-border bg-surface-secondary"
      >
        {current ? (
          // biome-ignore lint/performance/noImgElement: URL do bucket, sem otimização do Next
          <img src={current.url} alt={current.alt} className="size-full object-cover" />
        ) : (
          // biome-ignore lint/performance/noImgElement: arquivo estático local
          <img src="/placeholder-produto.svg" alt="Sem foto" className="size-full object-cover" />
        )}

        {canWrite && (
          <button
            type="button"
            aria-label="Editar imagens"
            title="Editar imagens"
            className={`${ICON_BUTTON} absolute top-2 right-2`}
            onClick={() => setEditing(true)}
          >
            <Pencil size={16} />
          </button>
        )}

        {hasMany && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              className={`${ICON_BUTTON} absolute top-1/2 left-2 -translate-y-1/2`}
              onClick={() => go(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Próxima foto"
              className={`${ICON_BUTTON} absolute top-1/2 right-2 -translate-y-1/2`}
              onClick={() => go(1)}
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5" role="tablist">
              {images.map((image, position) => (
                <button
                  key={image.media_id}
                  type="button"
                  role="tab"
                  aria-selected={position === index}
                  aria-label={`Foto ${position + 1} de ${images.length}`}
                  className={`size-2 rounded-full transition-colors ${position === index ? 'bg-geek-yellow' : 'bg-night/50 hover:bg-night/80'}`}
                  onClick={() => setRequested(position)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <Dialog open={editing} onChange={setEditing} title="Imagens do produto" size="lg">
        <ProductImages
          embedded
          productId={product.product_id}
          productName={product.name}
          media={product.media}
          canWrite={canWrite}
        />
      </Dialog>
    </>
  );
}
