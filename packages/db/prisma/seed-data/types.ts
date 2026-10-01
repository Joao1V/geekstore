// Mock de catálogo com dados reais (coletados em set/2026): produtos, slugs, preços, referências e
// imagens da própria Geek Store (lojageekstore.com) e preços de varejo de jogos vendidos no Brasil
// (Devir, Galápagos, Grok Games, MeepleBR). Códigos `9xxx` são inventados (sem referência na Tray);
// estoque, custo e peso são estimados. Não é a importação da Tray (RF-MIG-01).

export type SeedCategory = {
  slug: string;
  name: string;
  parent: string | null;
  featured?: boolean;
};

export type SeedCollection = {
  slug: string;
  name: string;
  kind: 'franchise' | 'curated';
  featured?: boolean;
  description?: string;
};

export type SeedSpecs = {
  players?: string;
  age?: string;
  minutes?: string;
  pieces?: string;
};

export type SeedSku = {
  code: string;
  attributes: Record<string, string>;
  price_cents: number;
  stock?: number;
  weight_g?: number;
  ean?: string;
};

export type SeedProduct = {
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  collections: string[];
  description: string;
  specs?: SeedSpecs;
  status?: 'draft' | 'active' | 'archived';
  images?: string[];
  skus: SeedSku[];
};
