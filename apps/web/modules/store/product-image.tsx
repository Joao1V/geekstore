'use client';

import { ImageOff } from 'lucide-react';
import { useState } from 'react';

/**
 * Foto do produto. Hoje as fotos vêm de links de terceiros (ainda não foram copiadas para o nosso
 * bucket), por isso `<img>` com `referrerPolicy` neutro em vez de `next/image` (que exigiria
 * liberar cada um dos ~750 domínios). Link quebrado cai num quadro com ícone, sem buraco na grade.
 */
export function ProductImage({
  src,
  alt,
  className = '',
  priority = false,
  fit = 'cover',
}: {
  src: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
  /** `contain` mostra o produto inteiro (fotos de caixa com fundo branco); `cover` preenche o quadro. */
  fit?: 'cover' | 'contain';
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={`flex size-full items-center justify-center bg-placeholder text-muted ${className}`}
      >
        <ImageOff size={32} aria-hidden="true" />
      </span>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: fotos de terceiros até a cópia para o bucket (ver comentário acima)
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`size-full ${fit === 'contain' ? 'bg-white object-contain p-3' : 'object-cover'} ${className}`}
    />
  );
}
