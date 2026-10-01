import { img, single } from './helpers';
import type { SeedProduct } from './types';

// ── LEGO ─────────────────────────────────────────────────────────────────────
export const legoProducts: SeedProduct[] = [
  single({
    slug: 'lego-one-piece-o-navio-pirata-going-merry-75639',
    name: 'LEGO One Piece – O Navio Pirata Going Merry (75639)',
    brand: 'LEGO',
    category: 'lego-one-piece',
    code: 'LEG-75639',
    price_cents: 156990,
    description:
      'Construa o icônico navio Going Merry com 1.376 peças e cinco minifiguras exclusivas dos Piratas do Chapéu de Palha. Mastros, velas, leme funcional, figura de proa de ovelha, canhão e interior com cabine da tripulação, cozinha e oficina.',
    collections: ['one-piece', 'novos-drops'],
    specs: { pieces: '1.376', age: '10+' },
    images: img(
      '90_lego_one_piece_o_navio_pirata_going_merry_75639_1_20250826155542_8cc1203c5365.jpeg',
      '90_lego_one_piece_o_navio_pirata_going_merry_75639_2_20250826155543_dd661adde99b.jpg',
      '90_lego_one_piece_o_navio_pirata_going_merry_75639_3_20250826155544_898ef6974bea.jpg',
      '90_lego_one_piece_o_navio_pirata_going_merry_75639_4_20250826155544_0f70c7375f8e.jpg',
      '90_lego_one_piece_o_navio_pirata_going_merry_75639_5_20250826155545_3446c21b2433.jpg',
      '90_lego_one_piece_o_navio_pirata_going_merry_75639_6_20250826155546_9cdcb81b8bd6.jpg'
    ),
    stock: 4,
    weight_g: 2300,
  }),
  single({
    slug: 'lego-one-piece-batalha-no-parque-arlong-75638',
    name: 'LEGO One Piece – Batalha no Parque Arlong (75638)',
    brand: 'LEGO',
    category: 'lego-one-piece',
    code: 'LEG-75638',
    price_cents: 96990,
    description:
      'Recria a batalha da série com 926 peças, cinco minifiguras e estruturas interativas, como um pagode que desmorona e um trono de tubarão. Ótimo para quem ama o anime e a versão live-action da Netflix.',
    collections: ['one-piece'],
    specs: { pieces: '926', age: '9+' },
    images: img(
      '90_lego_one_piece_batalha_no_parque_arlong_75638_1_20250826160005_00f8899ab73a.jpg',
      '90_lego_one_piece_batalha_no_parque_arlong_75638_2_20250826160006_2ad0b3fd45db.jpg',
      '90_lego_one_piece_batalha_no_parque_arlong_75638_3_20250826160007_629d7d859589.jpg',
      '90_lego_one_piece_batalha_no_parque_arlong_75638_4_20250826160007_e43a196416ab.jpg',
      '90_lego_one_piece_batalha_no_parque_arlong_75638_5_20250826160008_45f1860c798e.jpg',
      '90_lego_one_piece_batalha_no_parque_arlong_75638_6_20250826160009_3664effdaba2.jpg'
    ),
    weight_g: 1400,
  }),
  single({
    slug: 'lego-classic-caixa-criativa-feliz-680-pecas-11042',
    name: 'LEGO Classic – Caixa Criativa Feliz 680 Peças (11042)',
    brand: 'LEGO',
    category: 'lego-classic',
    code: 'LEG-11042',
    price_cents: 45990,
    description:
      'Conjunto de peças coloridas para construir 10 modelos inspiradores, que podem ser recriados em 12 brinquedos diferentes e personalizados de infinitas formas.',
    specs: { pieces: '680', age: '5+' },
    images: img(
      '90_lego_classic_caixa_criativa_feliz_680_pecas_11042_1_20250828154801_86c7c610f633.jpg',
      '90_lego_classic_caixa_criativa_feliz_680_pecas_11042_2_20250828154801_6740e66a3c98.jpg',
      '90_lego_classic_caixa_criativa_feliz_680_pecas_11042_3_20250828154802_1b61eb1080f4.jpg'
    ),
    weight_g: 900,
  }),
  single({
    slug: 'lego-classic-grande-caixa-de-tijolos-criativa-790-pecas-10698',
    name: 'LEGO Classic – Grande Caixa de Tijolos Criativa 790 Peças (10698)',
    brand: 'LEGO',
    category: 'lego-classic',
    code: 'LEG-10698',
    price_cents: 72490,
    description: 'Grande caixa de tijolos LEGO Classic com 790 peças para construir sem regras.',
    specs: { pieces: '790' },
    weight_g: 1600,
  }),
  single({
    slug: 'lego-icons-clube-de-jazz-10312',
    name: 'LEGO Icons – Clube de Jazz (10312)',
    brand: 'LEGO',
    category: 'lego-icons',
    code: 'LEG-10312',
    price_cents: 285590,
    description: 'Modelo modular de colecionador do Clube de Jazz, da linha LEGO Icons.',
    stock: 2,
    weight_g: 3900,
  }),
  single({
    slug: 'lego-technic-motocicleta-kawasaki-ninja-h2r',
    name: 'LEGO Technic – Motocicleta Kawasaki Ninja H2R',
    brand: 'LEGO',
    category: 'lego-technic',
    code: 'LEG-42170',
    price_cents: 94490,
    description:
      'Réplica da superesportiva Kawasaki Ninja H2R em LEGO Technic, para montar e expor.',
    weight_g: 1100,
  }),
];

// ── Colecionáveis ────────────────────────────────────────────────────────────
const fandom = (
  number: string,
  ref: number,
  name: string,
  slug: string,
  collections: string[]
): SeedProduct =>
  single({
    slug,
    name: `Fandom Box – ${name} (${number})`,
    brand: 'Fandom Box',
    category: 'fandom-box',
    code: `FBX-${ref}`,
    price_cents: 10990,
    description: `Colecionável de vinil de ${name.split(' – ').at(-1)}, com embalagem personalizada, ideal para exposição ou presente.`,
    collections,
    weight_g: 250,
  });

export const collectibleProducts: SeedProduct[] = [
  single({
    slug: 'funko-pop-disney-monster-sulley-1156',
    name: 'Funko POP! Disney Monster – Sulley (1156)',
    brand: 'Funko',
    category: 'funko-pop',
    code: 'FUN-POP-1156',
    price_cents: 14990,
    description: 'Boneco de vinil Funko POP! do Sulley, de Monstros S.A.',
    collections: ['disney'],
    weight_g: 300,
  }),
  single({
    slug: 'fandom-box-sonic-105',
    name: 'Fandom Box – Sonic (105)',
    brand: 'Fandom Box',
    category: 'fandom-box',
    code: 'FBX-20093',
    price_cents: 10990,
    description:
      'Colecionável de vinil do Sonic, com acabamento de alta qualidade e embalagem personalizada, ideal para exposição ou presente.',
    collections: ['sonic'],
    images: img(
      '90_fandom_box_sonic_105_1_20251024155829_9424d913d1d0.jpg',
      '90_fandom_box_sonic_105_2_20251024155830_d6effff9f75e.jpg',
      '90_fandom_box_sonic_105_3_20251024155830_baccab680969.jpg',
      '90_fandom_box_sonic_105_4_20251024155831_6e533de6b0b1.jpg'
    ),
    weight_g: 250,
  }),
  fandom('106', 9301, 'Sonic – Tails', 'fandom-box-sonic-tails-106', ['sonic']),
  fandom('084', 9302, 'Hello Kitty – My Melody', 'fandom-box-hello-kitty-my-melody-084', [
    'hello-kitty',
  ]),
  fandom('068', 9303, 'Hello Kitty – Keroppi', 'fandom-box-hello-kitty-keroppi-068-2233', [
    'hello-kitty',
  ]),
  fandom('132', 9304, 'Bola Pixar – Ansiedade', 'fandom-box-bola-pixar-ansiedade-132', ['disney']),
  fandom('129', 9305, 'Bola Pixar – Woody', 'fandom-box-bola-pixar-woody-129', ['disney']),
  fandom('133', 9306, 'Bola Pixar – Wall-E', 'fandom-box-bola-pixar-wall-e-133', ['disney']),
  fandom('073', 9307, 'Castelo Rá Tim Bum – Ratinho', 'fandom-box-castelo-ra-tim-bum-ratinho-073', [
    'castelo-ra-tim-bum',
  ]),
  fandom(
    '074',
    9308,
    'Castelo Rá Tim Bum – Porteiro',
    'fandom-box-castelo-ra-tim-bum-porteiro-074',
    ['castelo-ra-tim-bum']
  ),
];

// ── Mangás ───────────────────────────────────────────────────────────────────
const abyss = (volume: number, cents: number, ean?: string): SeedProduct =>
  single({
    slug: `made-in-abyss-volume-${String(volume).padStart(2, '0')}`,
    name: `Made in Abyss – Volume ${String(volume).padStart(2, '0')}`,
    brand: 'NewPOP',
    category: 'mangas',
    code: `MNG-MIA-${String(volume).padStart(2, '0')}`,
    price_cents: cents,
    description:
      'Riko, Reg e Nanachi seguem sua jornada rumo às profundezas do Abismo em uma aventura que mistura coragem e incerteza.',
    collections: ['made-in-abyss'],
    ean,
    weight_g: 180,
  });

export const mangaProducts: SeedProduct[] = [
  abyss(5, 2190),
  abyss(7, 2190),
  abyss(8, 2190),
  abyss(9, 2190),
  abyss(10, 3490),
  abyss(11, 3690, '9788583624790'),
  single({
    slug: 'a-voz-do-silencio-edicao-definitiva',
    name: 'A Voz do Silêncio (Edição Definitiva)',
    brand: null,
    category: 'mangas',
    code: 'MNG-9401',
    price_cents: 7690,
    description: 'Edição definitiva do mangá A Voz do Silêncio.',
    weight_g: 400,
  }),
  single({
    slug: 'monster-kanzenban',
    name: 'Monster Kanzenban',
    brand: null,
    category: 'mangas',
    code: 'MNG-9402',
    price_cents: 9990,
    description: 'Edição Kanzenban (formato especial) do mangá Monster.',
    weight_g: 500,
  }),
];

// ── Vestuário ────────────────────────────────────────────────────────────────
const SIZES = ['P', 'M', 'G', 'GG'] as const;

const shirt = (input: {
  slug: string;
  name: string;
  ref: number;
  brand: string | null;
  collections: string[];
  images?: string[];
  inStock?: readonly string[];
}): SeedProduct => ({
  slug: input.slug,
  name: input.name,
  brand: input.brand,
  category: 'camisetas',
  collections: input.collections,
  description:
    'Camiseta em algodão 100% com estampa licenciada. Confortável para o dia a dia de quem é fã.',
  images: input.images,
  skus: SIZES.map((size) => ({
    code: `VES-${input.ref}-${size}`,
    attributes: { tamanho: size },
    price_cents: 5990,
    stock: input.inStock ? (input.inStock.includes(size) ? 12 : 0) : undefined,
    weight_g: 220,
  })),
});

export const apparelProducts: SeedProduct[] = [
  shirt({
    slug: 'camiseta-unissex-harry-potter-elementos',
    name: 'Camiseta Harry Potter Elementos',
    ref: 12844,
    brand: 'Clube Comix',
    collections: ['harry-potter'],
    inStock: ['M', 'G'],
    images: img(
      '90_camiseta_unissex_harry_potter_elementos_263_1_3c95eb940b90e0cf6f5e235135cf174b.jpg',
      '90_camiseta_unissex_harry_potter_elementos_263_2_488ae514cd0f5b3c1938338c70eb68d6.jpg',
      '90_camiseta_unissex_harry_potter_elementos_263_3_e78c90ea65ff3c546f80ef74ac73daa5.jpg'
    ),
  }),
  shirt({
    slug: 'camiseta-harry-potter-anime-off-white',
    name: 'Camiseta Harry Potter Anime Off White',
    ref: 9501,
    brand: null,
    collections: ['harry-potter'],
  }),
  shirt({
    slug: 'camiseta-superman-80-anos-logo-melting-masculina',
    name: 'Camiseta Superman 80 Anos Logo Melting Masculina',
    ref: 9502,
    brand: null,
    collections: [],
  }),
  single({
    slug: 'pantufa-nickelodeon-bob-esponja',
    name: 'Pantufa Nickelodeon Bob Esponja',
    brand: null,
    category: 'pantufas',
    code: 'VES-9503',
    price_cents: 7990,
    description: 'Pantufa felpuda do Bob Esponja.',
    weight_g: 350,
  }),
  single({
    slug: 'meia-pantufofa-plataforma-9-harry-potter',
    name: 'Meia Pantufofa Plataforma 9 ¾ – Harry Potter',
    brand: null,
    category: 'pantufas',
    code: 'VES-9504',
    price_cents: 7990,
    description: 'Meia pantufa com a Plataforma 9 ¾, para quem vive o mundo bruxo.',
    collections: ['harry-potter'],
    weight_g: 150,
  }),
];

// ── Utensílios de bebida ─────────────────────────────────────────────────────
export const drinkwareProducts: SeedProduct[] = [
  single({
    slug: 'caneca-tom-stitch-e-angel-namorados-disney-350ml',
    name: 'Caneca Tom Stitch e Angel Namorados – Disney 350 mL',
    brand: 'Zona Criativa',
    category: 'canecas',
    code: 'CAN-17029',
    price_cents: 9990,
    description:
      'Caneca de cerâmica importada de 350 mL, para bebidas quentes ou frias, com o casal Stitch e Angel.',
    collections: ['disney'],
    images: img(
      '90_caneca_tom_stitch_e_angel_namorados_disney_350ml_1_20250909170159_b6babf61629b.jpg',
      '90_caneca_tom_stitch_e_angel_namorados_disney_350ml_2_20250909170200_a9542acdfc01.jpg',
      '90_caneca_tom_stitch_e_angel_namorados_disney_350ml_3_20250909170200_dea064eb4be1.jpg'
    ),
    weight_g: 450,
  }),
  single({
    slug: 'caneca-na-lata-dinsey-anna-e-elsa-350ml',
    name: 'Caneca na Lata Disney Anna e Elsa 350 mL',
    brand: null,
    category: 'canecas',
    code: 'CAN-9601',
    price_cents: 5990,
    description: 'Caneca de 350 mL que vem dentro de uma lata de presente, com Anna e Elsa.',
    collections: ['disney'],
    weight_g: 500,
  }),
  single({
    slug: 'caneca-na-lata-disney-branca-de-neve-350ml',
    name: 'Caneca na Lata Disney Branca de Neve 350 mL',
    brand: null,
    category: 'canecas',
    code: 'CAN-9602',
    price_cents: 5990,
    description: 'Caneca de 350 mL que vem dentro de uma lata de presente, com a Branca de Neve.',
    collections: ['disney'],
    weight_g: 500,
  }),
  single({
    slug: 'caneca-trio-alice-hora-do-cha-250ml',
    name: 'Caneca Trio Alice Hora do Chá 250 mL',
    brand: null,
    category: 'canecas',
    code: 'CAN-9603',
    price_cents: 7990,
    description: 'Trio de canecas de 250 mL inspirado na hora do chá de Alice.',
    collections: ['disney'],
    weight_g: 900,
  }),
  single({
    slug: 'copo-termico-tumbler-hello-kitty-1-15l',
    name: 'Copo Térmico Tumbler Hello Kitty 1,15 L',
    brand: null,
    category: 'copos',
    code: 'CAN-9604',
    price_cents: 23490,
    description: 'Copo térmico tumbler de 1,15 L da Hello Kitty.',
    collections: ['hello-kitty'],
    weight_g: 600,
  }),
  single({
    slug: 'copo-viagem-free-fire-booyah-450ml',
    name: 'Copo Viagem Free Fire Booyah 450 mL',
    brand: null,
    category: 'copos',
    code: 'CAN-9605',
    price_cents: 4990,
    description: 'Copo de viagem de 450 mL do Free Fire.',
    weight_g: 250,
  }),
  single({
    slug: 'garrafa-jupiter-hello-kitty-500ml',
    name: 'Garrafa Jupiter Hello Kitty 500 mL',
    brand: null,
    category: 'garrafas',
    code: 'CAN-9606',
    price_cents: 19490,
    description: 'Garrafa Jupiter de 500 mL da Hello Kitty.',
    collections: ['hello-kitty'],
    weight_g: 350,
  }),
  single({
    slug: 'garrafa-la-casa-de-papel-750ml',
    name: 'Garrafa La Casa de Papel 750 mL',
    brand: null,
    category: 'garrafas',
    code: 'CAN-9607',
    price_cents: 5490,
    description: 'Garrafa de 750 mL de La Casa de Papel.',
    weight_g: 300,
  }),
];
