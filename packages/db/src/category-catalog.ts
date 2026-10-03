// Taxonomia de categorias da Geek Store. É NOSSA (não a do ERP do cliente): o catálogo dele é que
// se adapta a ela. Fonte única: o seed, o importador do ERP e os testes criam as categorias a
// partir daqui (ver ensure-category-catalog.ts). Até 2 níveis (o limite do sistema é 3).
//
// `prefix` é o início do SKU de produto simples dessa categoria (MNG-12345); `attributes` são as
// variações que a categoria costuma ter (sugestão: o produto pode escolher outras).

export type CategorySeed = {
  slug: string;
  name: string;
  /** Prefixo de SKU; só nas categorias onde os produtos ficam (folhas, ou raiz sem filhas). */
  prefix?: string;
  /** Códigos de atributo sugeridos (herdados pelas filhas). Só na raiz. */
  attributes?: string[];
  featured?: boolean;
  children?: CategorySeed[];
};

export const CATEGORY_CATALOG: readonly CategorySeed[] = [
  {
    slug: 'jogos-e-cartas',
    name: 'Jogos e Cartas',
    attributes: ['idioma', 'apresentacao', 'edicao'],
    featured: true,
    children: [
      { slug: 'jogos-de-tabuleiro', name: 'Jogos de Tabuleiro', prefix: 'JTB' },
      { slug: 'cartas-e-baralhos', name: 'Cartas e Baralhos', prefix: 'CRT' },
      { slug: 'acessorios-de-jogo', name: 'Acessórios de Jogo', prefix: 'ACJ' },
      { slug: 'rpg', name: 'RPG', prefix: 'RPG' },
      { slug: 'quebra-cabecas', name: 'Quebra-cabeças', prefix: 'QBC' },
    ],
  },
  {
    slug: 'colecionaveis',
    name: 'Colecionáveis',
    attributes: ['edicao', 'escala', 'material'],
    featured: true,
    children: [
      { slug: 'funko', name: 'Funko', prefix: 'FNK' },
      { slug: 'bonecos-e-figuras', name: 'Bonecos e Figuras', prefix: 'BNC' },
      { slug: 'miniaturas-e-veiculos', name: 'Miniaturas e Veículos', prefix: 'MNT' },
      { slug: 'pelucias', name: 'Pelúcias', prefix: 'PEL' },
      { slug: 'brinquedos-e-hobbies', name: 'Brinquedos e Hobbies', prefix: 'BRQ' },
    ],
  },
  {
    slug: 'lego-e-blocos',
    name: 'LEGO e Blocos',
    featured: true,
    children: [
      { slug: 'lego', name: 'LEGO', prefix: 'LEG' },
      { slug: 'blocos-de-montar', name: 'Outros Blocos de Montar', prefix: 'BLC' },
    ],
  },
  {
    slug: 'hqs-mangas-e-livros',
    name: 'HQs, Mangás e Livros',
    attributes: ['idioma', 'formato'],
    featured: true,
    children: [
      { slug: 'mangas', name: 'Mangás', prefix: 'MNG' },
      { slug: 'hqs', name: 'HQs', prefix: 'HQS' },
      { slug: 'livros', name: 'Livros e Álbuns', prefix: 'LIV' },
    ],
  },
  {
    slug: 'moda-geek',
    name: 'Moda Geek',
    attributes: ['cor', 'tamanho', 'tamanho_infantil', 'numeracao', 'material'],
    featured: true,
    children: [
      { slug: 'camisetas', name: 'Camisetas', prefix: 'CAM' },
      { slug: 'agasalhos', name: 'Moletons e Agasalhos', prefix: 'AGS' },
      { slug: 'pijamas', name: 'Pijamas', prefix: 'PIJ' },
      { slug: 'fantasias', name: 'Fantasias', prefix: 'FAN' },
      { slug: 'calcados-e-pantufas', name: 'Calçados e Pantufas', prefix: 'CLC' },
      { slug: 'meias', name: 'Meias', prefix: 'MEI' },
      { slug: 'acessorios-de-moda', name: 'Acessórios de Moda', prefix: 'ACM' },
      { slug: 'moda-pet', name: 'Moda Pet', prefix: 'PET' },
    ],
  },
  {
    slug: 'casa-e-utensilios',
    name: 'Casa e Utensílios',
    attributes: ['cor', 'capacidade', 'material', 'voltagem'],
    children: [
      { slug: 'canecas', name: 'Canecas', prefix: 'CNC' },
      { slug: 'copos-e-garrafas', name: 'Copos e Garrafas', prefix: 'CPG' },
      { slug: 'almofadas', name: 'Almofadas', prefix: 'ALM' },
      { slug: 'decoracao-e-iluminacao', name: 'Decoração e Iluminação', prefix: 'DEC' },
      { slug: 'cozinha-e-lancheiras', name: 'Cozinha e Lancheiras', prefix: 'CZN' },
    ],
  },
  {
    slug: 'bolsas-e-mochilas',
    name: 'Bolsas e Mochilas',
    attributes: ['cor', 'material', 'capacidade'],
    children: [
      { slug: 'mochilas', name: 'Mochilas', prefix: 'MCH' },
      { slug: 'bolsas', name: 'Bolsas', prefix: 'BLS' },
      { slug: 'malas', name: 'Malas de Viagem', prefix: 'MAL' },
      { slug: 'carteiras-e-necessaires', name: 'Carteiras e Necessaires', prefix: 'CTR' },
    ],
  },
  {
    slug: 'papelaria-e-escritorio',
    name: 'Papelaria e Escritório',
    prefix: 'PAP',
    attributes: ['cor', 'tamanho'],
  },
  {
    slug: 'eletronicos-e-gadgets',
    name: 'Eletrônicos e Gadgets',
    prefix: 'ELE',
    attributes: ['voltagem', 'cor'],
  },
  {
    slug: 'alimentos-e-guloseimas',
    name: 'Alimentos e Guloseimas',
    prefix: 'ALI',
    attributes: ['sabor', 'peso', 'capacidade', 'embalagem'],
  },
  { slug: 'a-classificar', name: 'A classificar', prefix: 'GEN' },
];

export type TaxonomyNode = {
  slug: string;
  name: string;
  prefix: string | null;
  rootSlug: string;
  parentSlug: string | null;
};

const NODES = new Map<string, TaxonomyNode>(
  CATEGORY_CATALOG.flatMap((root) => [
    [
      root.slug,
      {
        slug: root.slug,
        name: root.name,
        prefix: root.prefix ?? null,
        rootSlug: root.slug,
        parentSlug: null,
      },
    ] as const,
    ...(root.children ?? []).map(
      (child) =>
        [
          child.slug,
          {
            slug: child.slug,
            name: child.name,
            prefix: child.prefix ?? null,
            rootSlug: root.slug,
            parentSlug: root.slug,
          },
        ] as const
    ),
  ])
);

export const FALLBACK_CATEGORY_SLUG = 'a-classificar';

/** A categoria da taxonomia pelo endereço (com a raiz dela). */
export function categoryNode(slug: string): TaxonomyNode {
  const node = NODES.get(slug);
  if (!node) throw new Error(`Categoria fora da taxonomia: ${slug}`);
  return node;
}

export function isKnownCategory(slug: string): boolean {
  return NODES.has(slug);
}
