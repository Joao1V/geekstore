'use client';

import { useState } from 'react';

/**
 * Miniatura de imagem para tabelas do admin. Usa `<img>` e não o next/image de propósito: as fotos
 * vêm de vários sites de terceiros (até irem para o nosso bucket) e o otimizador do Next exigiria
 * liberar cada domínio e faria o servidor baixar e reprocessar milhares de imagens. Sem foto, ou se
 * ela não carregar (links quebrados, sites que bloqueiam o uso direto), mostra o placeholder "Foto em breve".
 */
export function Thumbnail({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      // biome-ignore lint/performance/noImgElement: arquivo estático local
      <img
        src="/placeholder-produto.svg"
        alt=""
        width={48}
        height={48}
        className="size-12 shrink-0 rounded-md border border-border object-cover"
      />
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: fotos de terceiros, ver o comentário acima
    <img
      src={src}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-12 shrink-0 rounded-md border border-border bg-surface-secondary object-cover"
    />
  );
}
