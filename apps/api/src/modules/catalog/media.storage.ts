import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { MediaUploadUrlBody } from '@geekstore/shared';

import { ExternalApiError } from '../../core/_errors';
import { envConfig } from '../../core/config';

const UPLOAD_URL_TTL_SECONDS = 300;

const EXTENSION_BY_CONTENT_TYPE: Record<MediaUploadUrlBody['content_type'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type ResolvedS3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
};

/** Sem bucket configurado a API sobe normalmente; só o upload de imagem responde erro claro. */
function resolveS3Config(): ResolvedS3Config {
  const { ENDPOINT, REGION, BUCKET, ACCESS_KEY_ID, SECRET_ACCESS_KEY, PUBLIC_BASE_URL } =
    envConfig.s3;

  if (!ENDPOINT || !BUCKET || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !PUBLIC_BASE_URL) {
    throw new ExternalApiError('Armazenamento de imagens não configurado neste ambiente.', {
      missing_env:
        'S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_BASE_URL',
    });
  }
  return {
    endpoint: ENDPOINT,
    region: REGION,
    bucket: BUCKET,
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
    publicBaseUrl: PUBLIC_BASE_URL.replace(/\/+$/, ''),
  };
}

export function buildObjectKey(contentType: MediaUploadUrlBody['content_type'], now: Date): string {
  const yearMonth = now.toISOString().slice(0, 7).replace('-', '/');
  return `products/${yearMonth}/${randomUUID()}.${EXTENSION_BY_CONTENT_TYPE[contentType]}`;
}

/**
 * URL pré-assinada de PUT: o navegador envia a imagem direto ao bucket. `content-type` e
 * `content-length` entram na assinatura, então um arquivo de outro tipo ou tamanho é recusado.
 */
export async function createUploadUrl(body: MediaUploadUrlBody) {
  const config = resolveS3Config();
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    // O SDK novo embute CRC32 do corpo vazio na URL pré-assinada; o bucket recusaria o PUT real.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });

  const key = buildObjectKey(body.content_type, new Date());
  try {
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: body.content_type,
        ContentLength: body.size_bytes,
      }),
      {
        expiresIn: UPLOAD_URL_TTL_SECONDS,
        signableHeaders: new Set(['content-type', 'content-length']),
      }
    );
    return {
      upload_url: uploadUrl,
      public_url: `${config.publicBaseUrl}/${key}`,
      expires_in: UPLOAD_URL_TTL_SECONDS,
    };
  } finally {
    client.destroy();
  }
}
