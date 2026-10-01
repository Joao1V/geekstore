import type { SeedProduct, SeedSpecs } from './types';

const IMG_BASE = 'https://images.tcdn.com.br/img/img_prod/1322237/';

/** Nome do arquivo no CDN da Geek Store -> URL completa. */
export function img(...files: string[]): string[] {
  return files.map((file) => `${IMG_BASE}${file}`);
}

type Single = {
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  /** Código do SKU: prefixo da categoria + referência (Tray) ou número inventado 9xxx. */
  code: string;
  price_cents: number;
  description: string;
  collections?: string[];
  specs?: SeedSpecs;
  status?: SeedProduct['status'];
  images?: string[];
  stock?: number;
  weight_g?: number;
  ean?: string;
};

/** Produto simples: 1 SKU (RF-CAT-04). */
export function single(input: Single): SeedProduct {
  return {
    slug: input.slug,
    name: input.name,
    brand: input.brand,
    category: input.category,
    collections: input.collections ?? [],
    description: input.description,
    specs: input.specs,
    status: input.status,
    images: input.images,
    skus: [
      {
        code: input.code,
        attributes: {},
        price_cents: input.price_cents,
        stock: input.stock,
        weight_g: input.weight_g,
        ean: input.ean,
      },
    ],
  };
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
