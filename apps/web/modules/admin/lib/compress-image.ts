import { allowedImageTypes, maxImageBytes } from '@geekstore/shared';

type UploadContentType = (typeof allowedImageTypes)[number];

const MAX_DIMENSION_PX = 2000;
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.5, 0.4];
const SCALE_STEP = 0.8;
const MAX_SCALE_ROUNDS = 4;

export type CompressedImage = { blob: Blob; contentType: UploadContentType };

function encode(canvas: HTMLCanvasElement, type: UploadContentType, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Redimensiona (lado maior até 2000px) e recomprime no navegador (webp; jpeg se o navegador não
 * codifica webp) até caber em `maxImageBytes`. Lança erro se não conseguir.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  if (!allowedImageTypes.includes(file.type as UploadContentType)) {
    throw new Error('Formato não suportado. Use JPEG, PNG ou WebP.');
  }
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, MAX_DIMENSION_PX / Math.max(bitmap.width, bitmap.height));

  for (let round = 0; round <= MAX_SCALE_ROUNDS; round += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível processar a imagem neste navegador.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITY_STEPS) {
      const webp = await encode(canvas, 'image/webp', quality);
      const blob =
        webp && webp.type === 'image/webp' ? webp : await encode(canvas, 'image/jpeg', quality);
      if (blob && blob.size <= maxImageBytes) {
        return { blob, contentType: blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg' };
      }
    }
    scale *= SCALE_STEP;
  }
  bitmap.close();
  throw new Error('Não foi possível reduzir a imagem para o tamanho máximo permitido.');
}
