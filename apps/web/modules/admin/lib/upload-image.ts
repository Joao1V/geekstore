import { adminApi } from './admin-api';
import { compressImage } from './compress-image';

type UploadUrl = { upload_url: string; public_url: string; expires_in: number };

/**
 * Comprime no navegador, pede a URL pré-assinada e faz o PUT direto no bucket. Devolve a URL pública.
 * Serve a qualquer imagem do admin (foto de produto, logo de marca, banner).
 */
export async function uploadImageToBucket(file: File): Promise<string> {
  const { blob, contentType } = await compressImage(file);
  const target = await adminApi.post<UploadUrl>('/api/catalog/media/upload-url', {
    content_type: contentType,
    size_bytes: blob.size,
  });
  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(target.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
  } catch {
    throw new Error('Falha de rede ao enviar a imagem para o armazenamento.');
  }
  if (!uploadResponse.ok) throw new Error('O armazenamento recusou o envio da imagem.');
  return target.public_url;
}
