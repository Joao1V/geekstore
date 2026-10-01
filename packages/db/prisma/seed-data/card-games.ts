import { img, single, slugify } from './helpers';
import type { SeedProduct, SeedSpecs } from './types';

const CARDS = 'jogosdecartas';

type Card = {
  name: string;
  brand: string;
  cents: number;
  ref: number;
  desc: string;
  specs?: SeedSpecs;
  cols?: string[];
  weight?: number;
};

function card(input: Card): SeedProduct {
  return single({
    slug: slugify(input.name),
    name: input.name,
    brand: input.brand,
    category: CARDS,
    code: `JCT-${input.ref}`,
    price_cents: input.cents,
    description: input.desc,
    collections: input.cols,
    specs: input.specs,
    weight_g: input.weight ?? 250,
  });
}

// ── Jogos de cartas ──────────────────────────────────────────────────────────
export const cardGames: SeedProduct[] = [
  // Da Geek Store (slug, referência e imagens reais)
  single({
    slug: 'jogo-de-cartas-hanabi',
    name: 'Jogo de Cartas Hanabi',
    brand: 'Papergames',
    category: CARDS,
    code: 'JCT-7321',
    price_cents: 7590,
    description:
      'Cooperativo em que os jogadores montam o espetáculo de fogos perfeito: você segura as cartas de modo que só os outros jogadores as vejam. Esta edição inclui duas expansões para aumentar a dificuldade.',
    collections: ['cooperativos', 'jogos-rapidos', 'para-a-familia'],
    specs: { players: '2-5', age: '8+', minutes: '30' },
    images: img(
      '90_jogo_de_cartas_hanabi_1_20251124144329_5970f2f44373.jpg',
      '90_jogo_de_cartas_hanabi_2_20251124144329_ab89b64211e9.jpg',
      '90_jogo_de_cartas_hanabi_3_20251124144329_d50c31af1fa8.jpg',
      '90_jogo_de_cartas_hanabi_4_20251124144329_223a4b88edad.jpg'
    ),
    weight_g: 200,
  }),
  single({
    slug: 'jogo-de-cartas-mimic-octopus',
    name: 'Jogo de Cartas Mimic Octopus',
    brand: 'Burô',
    category: CARDS,
    code: 'JCT-20598',
    price_cents: 10490,
    description:
      'Os participantes discutem temas acreditando que falam do mesmo assunto, descobrem aliados e se infiltram nas equipes rivais usando habilidades de adaptação.',
    collections: ['party-games', 'jogos-rapidos', 'novos-drops'],
    specs: { players: '4-8', age: '14+', minutes: '30' },
    images: img(
      '90_jogo_de_cartas_mimic_octopus_1_20251113155339_3b7bcb39d35d.jpg',
      '90_jogo_de_cartas_mimic_octopus_2_20251113155339_e5303050d1a4.jpg',
      '90_jogo_de_cartas_mimic_octopus_3_20251113155339_2117910e2c1b.jpg'
    ),
    weight_g: 250,
  }),
  single({
    slug: 'jogo-de-cartas-fuga-do-zoo',
    name: 'Jogo de Cartas Fuga do Zoo',
    brand: 'Adoleta Jogos',
    category: CARDS,
    code: 'JCT-7354',
    price_cents: 12190,
    description:
      'Dois jogos em uma caixa com animais do zoológico: combine cartas para libertar os bichos antes que o tratador chegue, ou dispute uma corrida de kart temática.',
    collections: ['para-a-familia', 'jogos-rapidos'],
    specs: { players: '1-5', age: '4+', minutes: '10' },
    images: img(
      '90_jogo_de_cartas_fuga_do_zoo_1_20251031174832_699a81d6038b.jpg',
      '90_jogo_de_cartas_fuga_do_zoo_2_20251031174833_9ab10f4a2fcb.jpg',
      '90_jogo_de_cartas_fuga_do_zoo_3_20251031174833_0479a54dc397.jpg'
    ),
    weight_g: 300,
  }),
  single({
    slug: 'jogo-de-cartas-trick-of-the-rails-baroes-das-ferrovias',
    name: 'Jogo de Cartas Trick of the Rails: Barões das Ferrovias',
    brand: 'Grok Games',
    category: CARDS,
    code: 'JCT-11491',
    price_cents: 13990,
    description:
      'Combina dinâmica de vazas com gestão de portfólio: adquira ações e construa redes ferroviárias para valorizar suas empresas e se tornar o barão das ferrovias.',
    collections: ['estrategia', 'jogos-rapidos'],
    specs: { players: '3-5', age: '14+', minutes: '30' },
    images: img(
      '90_jogo_de_cartas_trick_of_the_rails_bares_das_ferrov_1_20251031160241_9db472d467f9.jpg',
      '90_jogo_de_cartas_trick_of_the_rails_bares_das_ferrov_2_20251031160242_3c67703e7c46.jpg'
    ),
    weight_g: 250,
  }),
  // Do mercado brasileiro
  card({
    name: 'Exploding Kittens (Edição Revisada)',
    brand: 'Galápagos',
    cents: 9400,
    ref: 9101,
    desc: 'Jogo de cartas de sorte e estratégia: evite a carta do gatinho explosivo e faça o rival explodir no seu lugar.',
    specs: { players: '2-5', age: '7+', minutes: '15' },
    cols: ['party-games', 'jogos-rapidos', 'para-a-familia'],
  }),
  card({
    name: 'Love Letter (2ª edição)',
    brand: 'Galápagos',
    cents: 9900,
    ref: 9102,
    desc: 'Dedução em cartas: faça chegar sua carta à princesa usando poucos personagens e muita blefada.',
    specs: { players: '2-4', age: '10+', minutes: '20' },
    cols: ['jogos-rapidos', 'para-dois-jogadores'],
  }),
  card({
    name: 'Coup (2ª edição) + Expansão A Reforma',
    brand: 'Galápagos',
    cents: 8900,
    ref: 9103,
    desc: 'Blefe e dedução numa república corrompida: elimine as influências dos adversários e seja o último com poder.',
    specs: { players: '2-6', age: '10+', minutes: '15' },
    cols: ['party-games', 'jogos-rapidos'],
  }),
  card({
    name: 'Munchkin',
    brand: 'Galápagos',
    cents: 14900,
    ref: 9104,
    desc: 'Paródia de RPG em cartas: entre nas masmorras, derrote monstros, pegue tesouros e passe a perna nos amigos.',
    specs: { players: '3-6', age: '10+', minutes: '90' },
    cols: ['party-games'],
  }),
  card({
    name: 'The Mind',
    brand: 'Galápagos',
    cents: 7900,
    ref: 9105,
    desc: 'Cooperativo de sintonia: jogue as cartas em ordem crescente sem trocar nenhuma informação.',
    specs: { players: '2-4', age: '8+', minutes: '20' },
    cols: ['cooperativos', 'jogos-rapidos'],
  }),
  card({
    name: 'Ito: Jogo de Cartas',
    brand: 'MeepleBR',
    cents: 9900,
    ref: 9106,
    desc: 'Cooperativo de comunicação: use palavras e expressões para ordenar números sem revelá-los.',
    specs: { players: '2-14', age: '8+', minutes: '20' },
    cols: ['cooperativos', 'party-games', 'jogos-rapidos'],
  }),
  card({
    name: 'Pega em 6!',
    brand: 'Galápagos',
    cents: 12400,
    ref: 9107,
    desc: 'Clássico de cartas em que todos jogam ao mesmo tempo: fuja de pegar as fileiras cheias de cabeças de boi.',
    specs: { players: '2-10', age: '8+', minutes: '45' },
    cols: ['party-games', 'para-a-familia', 'classicos-modernos'],
  }),
  card({
    name: 'Red7 (Linha Pocket)',
    brand: 'Galápagos',
    cents: 6800,
    ref: 9108,
    desc: 'Jogo de cartas de regras que mudam a cada jogada: para vencer, tenha sempre a melhor mão pela regra da vez.',
    specs: { players: '2-4', age: '8+', minutes: '15' },
    cols: ['jogos-rapidos', 'para-dois-jogadores'],
  }),
  card({
    name: 'Arkham Horror: Card Game (Jogo Base)',
    brand: 'Galápagos',
    cents: 49900,
    ref: 9109,
    desc: 'Jogo de cartas cooperativo e narrativo (LCG): investigue mistérios sobrenaturais em Arkham montando o seu baralho de investigador.',
    specs: { players: '1-2', age: '14+', minutes: '60-120' },
    cols: ['cooperativos', 'estrategia'],
    weight: 900,
  }),
  card({
    name: 'Pocket Detective',
    brand: 'MeepleBR',
    cents: 4400,
    ref: 9110,
    desc: 'Casos policiais de bolso em formato de cartas: analise as pistas e descubra o culpado.',
    cols: ['cooperativos', 'jogos-rapidos'],
  }),
];

// ── Card games colecionáveis (TCG) ───────────────────────────────────────────
export const tcgProducts: SeedProduct[] = [
  single({
    slug: 'bundle-magic-the-gathering-aetherdrift',
    name: 'Bundle Magic: The Gathering – Aetherdrift',
    brand: 'Magic: The Gathering',
    category: 'magic-the-gathering',
    code: 'TCG-15583',
    price_cents: 53990,
    description:
      '9 Play Boosters de Aetherdrift com cards de raridade elevada e foils, mais acessórios como contador de vida spindown e caixa de armazenamento. Inclui 20 cards foil tradicionais, 20 terrenos não foil e referências de jogo.',
    collections: ['novos-drops'],
    images: img(
      '90_bundle_magic_the_gathering_aetherdrift_1843_1_056762368f889a8f19eca6137d70765a.jpg',
      '90_bundle_magic_the_gathering_aetherdrift_1843_2_a70f9af89a74d1a6c93c036481b2121f.jpg'
    ),
    weight_g: 900,
  }),
  single({
    slug: 'finish-line-bundle-magic-the-gathering-aetherdrift',
    name: 'Finish Line Bundle Magic: The Gathering – Aetherdrift',
    brand: 'Magic: The Gathering',
    category: 'magic-the-gathering',
    code: 'TCG-9201',
    price_cents: 77990,
    description:
      'Edição Finish Line do bundle de Aetherdrift, com boosters e itens exclusivos do lançamento.',
    weight_g: 1200,
  }),
  single({
    slug: 'deck-commander-edicao-de-colecionador-modern-horizons-3-tricky-terrain',
    name: 'Deck Commander Edição de Colecionador – Modern Horizons 3: Tricky Terrain',
    brand: 'Magic: The Gathering',
    category: 'magic-the-gathering',
    code: 'TCG-9202',
    price_cents: 119590,
    description: 'Deck Commander pré-montado em edição de colecionador, de Modern Horizons 3.',
    stock: 3,
    weight_g: 700,
  }),
  single({
    slug: 'yu-gi-oh-edicao-especial-fusao-da-alma',
    name: 'Yu-Gi-Oh! Edição Especial – Fusão da Alma',
    brand: 'Konami',
    category: 'yu-gi-oh',
    code: 'TCG-9203',
    price_cents: 5890,
    description: 'Edição especial de Yu-Gi-Oh! com cartas de Fusão da Alma.',
    weight_g: 120,
  }),
  single({
    slug: 'yu-gi-oh-deck-dos-deuses-egipcios-obelisco-o-atormentador',
    name: 'Yu-Gi-Oh! Deck dos Deuses Egípcios – Obelisco, o Atormentador',
    brand: 'Konami',
    category: 'yu-gi-oh',
    code: 'TCG-9204',
    price_cents: 14490,
    description:
      'Deck pronto para jogar centrado em Obelisco, o Atormentador, um dos três Deuses Egípcios.',
    weight_g: 250,
  }),
  single({
    slug: 'dragon-ball-super-card-game-starter-deck-son-goku',
    name: 'Dragon Ball Super: Card Game – Starter Deck: Son Goku',
    brand: 'Bandai',
    category: 'dragon-ball-super',
    code: 'TCG-14232',
    price_cents: 12490,
    description:
      'Baralho inicial pronto para jogar, com 51 cartas. Inclui marcador de energia, folha de jogo com manual de regras, pacote de bônus e código promocional para a versão digital.',
    collections: ['dragon-ball'],
    images: img(
      '90_dragon_ball_super_card_game_starter_deck_son_goku_1977_1_c4d709fd037004f009d693b995b89ad6.jpg',
      '90_dragon_ball_super_card_game_starter_deck_son_goku_1977_2_12b4c1f457d82c9eeb2178075764673e.jpg',
      '90_dragon_ball_super_card_game_starter_deck_son_goku_1977_3_cc3c759fcfa220f346904aa48bf97193.jpg',
      '90_dragon_ball_super_card_game_starter_deck_son_goku_1977_4_016424caf3886bae3c2e3bf28143b4bd.jpg'
    ),
    weight_g: 200,
  }),
  ...[
    ['Bardock', 9211],
    ['Frieza', 9212],
    ['Broly', 9213],
    ['Vegeta', 9214],
  ].map(([hero, ref]) =>
    single({
      slug: `dragon-ball-super-card-game-starter-deck-${String(hero).toLowerCase()}`,
      name: `Dragon Ball Super: Card Game – Starter Deck: ${hero}`,
      brand: 'Bandai',
      category: 'dragon-ball-super',
      code: `TCG-${ref}`,
      price_cents: 12490,
      description: `Baralho inicial de Dragon Ball Super Card Game com ${hero} como líder, pronto para jogar.`,
      collections: ['dragon-ball'],
      weight_g: 200,
    })
  ),
  single({
    slug: 'tapete-para-jogo-gamegenic-61-x-35cm-2mm',
    name: 'Tapete para Jogo Gamegenic 61 x 35cm 2mm',
    brand: 'Gamegenic',
    category: 'acessorios-card-game',
    code: 'ACE-9221',
    price_cents: 9990,
    description: 'Tapete de jogo de 61 x 35 cm com 2 mm de espessura, para partidas de card game.',
    weight_g: 300,
  }),
  single({
    slug: 'deck-box-gamegenic-sidekick-100',
    name: 'Deck Box Gamegenic Sidekick 100+',
    brand: 'Gamegenic',
    category: 'acessorios-card-game',
    code: 'ACE-9222',
    price_cents: 19190,
    description: 'Porta-deck Gamegenic Sidekick para 100+ cartas com sleeve.',
    weight_g: 250,
  }),
  single({
    slug: 'deck-box-gamegenic-stronghold-200',
    name: 'Deck Box Gamegenic Stronghold 200+',
    brand: 'Gamegenic',
    category: 'acessorios-card-game',
    code: 'ACE-9223',
    price_cents: 40190,
    description: 'Porta-deck Gamegenic Stronghold para 200+ cartas com sleeve.',
    weight_g: 600,
  }),
  single({
    slug: 'sleeve-mosaico-padrao-cristal-63-5-x-88-mm-100-unidades',
    name: 'Sleeve Mosaico Padrão Cristal 63,5 x 88 mm (100 unidades)',
    brand: 'Mosaico',
    category: 'acessorios-card-game',
    code: 'ACE-9224',
    price_cents: 1000,
    description: 'Protetores de carta transparentes, padrão 63,5 x 88 mm, pacote com 100 unidades.',
    weight_g: 60,
  }),
  single({
    slug: 'rpg-starter-kit-q-workshop',
    name: 'RPG Starter Kit – Q Workshop',
    brand: 'Q Workshop',
    category: 'dados',
    code: 'RPG-20604',
    price_cents: 18990,
    description:
      'Kit para iniciantes com os dados essenciais (d4, d6, d8, d10, d10 dezena, d12 e d20) para os sistemas de RPG mais populares. Inclui bolsa para dados, caderno, lápis com borracha e placar de progresso.',
    images: img(
      '90_rpg_starter_kit_q_workshop_1_20251118162838_a62301eefc83.jpg',
      '90_rpg_starter_kit_q_workshop_2_20251118162838_9adca60ca537.jpg'
    ),
    weight_g: 350,
  }),
];
