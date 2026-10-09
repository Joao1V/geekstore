'use client';

import { useState } from 'react';

/**
 * Foto do produto. Hoje as fotos vêm de links de terceiros (ainda não foram copiadas para o nosso
 * bucket), por isso `<img>` com `referrerPolicy` neutro em vez de `next/image` (que exigiria
 * liberar cada um dos ~750 domínios). Sem foto, ou com o link quebrado, aparece o placeholder "Foto em
 * breve" (`public/placeholder-produto.svg`), sem buraco na grade.
 */
export const PLACEHOLDER_SRC = '/placeholder-produto.svg';

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
      // biome-ignore lint/performance/noImgElement: arquivo estático local, sem o que o next/image otimizaria
      <img
        src={PLACEHOLDER_SRC}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        className={`size-full object-cover ${className}`}
      />
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
