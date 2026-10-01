import { img, single } from './helpers';
import type { SeedProduct } from './types';

const CAT = 'jogos-de-tabuleiro';

// Jogos de tabuleiro que já estão no catálogo da Geek Store (slug, preço, referência e imagens reais).
export const storeBoardGames: SeedProduct[] = [
  single({
    slug: '5-minutes-dungeon',
    name: '5 Minutes Dungeon',
    brand: 'Galápagos',
    category: CAT,
    code: 'JTB-11216',
    price_cents: 28590,
    description:
      'Jogo cooperativo, caótico e frenético de cartas: usem o raciocínio rápido para enfrentar monstros e vilões, superar armadilhas e derrotar chefes em apenas 5 minutos.',
    collections: ['cooperativos', 'jogos-rapidos', 'party-games'],
    specs: { players: '2-5', age: '14+', minutes: '5' },
    images: img(
      '90_5_minutes_dungeon_1901_1_016cd1343798e6ff23d5ff6b03e914bf.jpg',
      '90_5_minutes_dungeon_1901_2_1117d83c9d54a1689db2177687a35363.jpg',
      '90_5_minutes_dungeon_1901_3_9cd1771cb712650b0482fb3e139896bf.jpg',
      '90_5_minutes_dungeon_1901_4_5931e88791953295b3167c0384097c43.jpg'
    ),
    weight_g: 900,
  }),
  single({
    slug: 'pandemic-pandemia-1945',
    name: 'Pandemic (Pandemia)',
    brand: 'Galápagos',
    category: CAT,
    code: 'JTB-6926',
    price_cents: 39390,
    description:
      'Jogo cooperativo em que os jogadores assumem o papel de especialistas para tratar focos de doença e pesquisar a cura das quatro pragas antes que elas saiam do controle.',
    collections: ['cooperativos', 'classicos-modernos'],
    specs: { players: '2-4', age: '14+' },
    images: img(
      '90_pandemic_pandemia_1945_1_6a5b5736bf4a6e70b3260b5ea106a806.jpg',
      '90_pandemic_pandemia_1945_2_ad1fbb963c701b54720e3409240a6d61.jpg',
      '90_pandemic_pandemia_1945_3_1bfb381541fbe7ad3afe41fbfa35e5e1.jpg'
    ),
    weight_g: 1300,
  }),
  single({
    slug: '7-wonders',
    name: '7 Wonders',
    brand: 'Galápagos',
    category: CAT,
    code: 'JTB-14038',
    price_cents: 44490,
    description:
      'Lidere uma das sete maravilhas da Antiguidade em três eras. Mistura estratégia, análise de cenários e um pouco de sorte, com seis turnos por era.',
    collections: ['estrategia', 'classicos-modernos'],
    specs: { players: '3-7', age: '10+', minutes: '30' },
    images: img(
      '90_7_wonders_1903_1_ae217afb8ba018ce0f085db5eb8ebc53.jpg',
      '90_7_wonders_1903_2_ae8f4507efe6280e558edcfce5e55899.jpg',
      '90_7_wonders_1903_3_b8943b07935633bddd90590dea5a5b34.jpg',
      '90_7_wonders_1903_4_01e62035c7114ab4988365fb6fa8c6a5.jpg'
    ),
    weight_g: 1600,
  }),
  single({
    slug: 'jogo-de-tabuleiro-frosthaven',
    name: 'Jogo de Tabuleiro Frosthaven',
    brand: 'Galápagos',
    category: CAT,
    code: 'JTB-18314',
    price_cents: 310990,
    description:
      'Experiência cooperativa de combate tático em um mundo fantástico: mercenários enfrentam inimigos controlados pelo jogo e ajudam a construir o arraial de Frosthaven. 17 classes de personagem, 138 cenários, mais de 2.500 cartas e 18 miniaturas plásticas.',
    collections: ['cooperativos', 'estrategia', 'novos-drops'],
    specs: { players: '1-4', age: '14+' },
    images: img(
      '90_jogo_de_tabuleiro_frosthaven_1_20250901174539_ab4c69fa9207.jpg',
      '90_jogo_de_tabuleiro_frosthaven_2_20250901174539_8a41ad85cc23.jpg',
      '90_jogo_de_tabuleiro_frosthaven_3_20250901174540_5b6d26e293b3.jpg',
      '90_jogo_de_tabuleiro_frosthaven_4_20250901174540_443d07769c7c.jpg',
      '90_jogo_de_tabuleiro_frosthaven_5_20250901174541_6e25f5c08b6a.jpg'
    ),
    stock: 2,
    weight_g: 9800,
  }),
  single({
    slug: 'jogo-de-tabuleiro-cities',
    name: 'Jogo de Tabuleiro Cities',
    brand: 'Devir',
    category: CAT,
    code: 'JTB-15918',
    price_cents: 44990,
    description:
      'Construção urbana em cidades icônicas como Sydney, Veneza e Nova York. Combina colocação de trabalhadores e formação de padrões para criar projetos impressionantes.',
    collections: ['estrategia', 'novos-drops'],
    specs: { players: '2-4', age: '10+', minutes: '45' },
    images: img(
      '90_jogo_de_tabuleiro_cities_1_20251030170754_17f9192c358a.jpg',
      '90_jogo_de_tabuleiro_cities_2_20251030170755_601a9aca7404.jpg',
      '90_jogo_de_tabuleiro_cities_3_20251030170756_5d4a0f7ef70e.jpg',
      '90_jogo_de_tabuleiro_cities_4_20251030170756_6f44ffdfa46b.jpg',
      '90_jogo_de_tabuleiro_cities_5_20251030170757_98e249739897.jpg'
    ),
    weight_g: 1400,
  }),
  single({
    slug: 'jogo-de-tabuleiro-karekare',
    name: 'Jogo de Tabuleiro Karekare',
    brand: 'Devir',
    category: CAT,
    code: 'JTB-9214',
    price_cents: 30790,
    description:
      'Você lidera uma tribo para explorar as ilhas de Aotearoa (Nova Zelândia) e acumular honra. Rápido, de regras simples, com controle de área e temática ecológica.',
    collections: ['estrategia', 'para-a-familia'],
    specs: { players: '2-4', age: '10+', minutes: '45' },
    images: img(
      '90_jogo_de_tabuleiro_karekare_1_20251030162204_773a806ac834.jpg',
      '90_jogo_de_tabuleiro_karekare_2_20251030162205_8229ec1a5a2f.jpg',
      '90_jogo_de_tabuleiro_karekare_3_20251030162205_0e1bf3abb9e1.jpg'
    ),
    weight_g: 1100,
  }),
  single({
    slug: 'jogo-de-tabuleiro-chicago-dry',
    name: 'Jogo de Tabuleiro Chicago Dry',
    brand: 'Burô',
    category: CAT,
    code: 'JTB-20600',
    price_cents: 28290,
    description:
      'Durante a Lei Seca americana, distribua bebidas em segredo pelos bairros de Chicago enquanto disputa território com os rivais. Vence quem tiver mais influência nas duas fases e se tornar o gângster mais infame da cidade.',
    collections: ['estrategia', 'novos-drops'],
    specs: { players: '2-4', age: '14+', minutes: '45' },
    images: img(
      '90_jogo_de_tabuleiro_chicago_dry_1_20251119163336_2bc08051d981.jpg',
      '90_jogo_de_tabuleiro_chicago_dry_2_20251119163336_d0ac9259f05a.jpg',
      '90_jogo_de_tabuleiro_chicago_dry_3_20251119163336_c00fef06936f.jpg',
      '90_jogo_de_tabuleiro_chicago_dry_4_20251119163336_d4d244804608.jpg'
    ),
    weight_g: 1000,
  }),
  single({
    slug: 'ubongo-classic',
    name: 'Ubongo! Classic',
    brand: 'Devir',
    category: CAT,
    code: 'JTB-1667',
    price_cents: 38390,
    description:
      'Quebra-cabeça contra o tempo: encaixe as peças nas cartelas antes que a ampulheta acabe. Quem conquistar as gemas de maior valor depois de 9 rodadas vence.',
    collections: ['para-a-familia', 'jogos-rapidos'],
    specs: { players: '1-4', age: '8+' },
    images: img(
      '90_ubongo_classic_1947_1_423f53749da7358dc68e44aebf03e656.jpg',
      '90_ubongo_classic_1947_2_92572f55b3050ce1399555182bc65485.jpg'
    ),
    weight_g: 1200,
  }),
  single({
    slug: 'jogo-de-tabuleiro-the-goonies-never-say-die-em-ingles',
    name: 'Jogo de Tabuleiro The Goonies Never Say Die (em Inglês)',
    brand: 'Funko Games',
    category: CAT,
    code: 'JTB-18315',
    price_cents: 43990,
    description:
      'Reviva a aventura clássica dos anos 80 em uma experiência cooperativa e narrativa: exploradores enfrentam vilões em busca do tesouro. Campanha com 9 aventuras conectadas, miniaturas detalhadas e alta rejogabilidade.',
    collections: ['cooperativos', 'goonies'],
    specs: { players: '2-5', age: '12+' },
    images: img(
      '90_jogo_de_tabuleiro_the_goonies_never_say_die_em_ing_1_20250830135603_451b1ac87011.jpg',
      '90_jogo_de_tabuleiro_the_goonies_never_say_die_em_ing_2_20250830135604_08b397dcfc81.jpg',
      '90_jogo_de_tabuleiro_the_goonies_never_say_die_em_ing_3_20250830135605_59406c21ebd2.jpg',
      '90_jogo_de_tabuleiro_the_goonies_never_say_die_em_ing_4_20250830135605_8de45157a1a0.jpg',
      '90_jogo_de_tabuleiro_the_goonies_never_say_die_em_ing_5_20250830135606_327370e74cb7.jpg',
      '90_jogo_de_tabuleiro_the_goonies_never_say_die_em_ing_6_20250830135607_da3c0a3cd31c.jpg'
    ),
    weight_g: 2600,
  }),
  single({
    slug: '3-ring-circus',
    name: '3 Ring Circus',
    brand: 'Devir',
    category: CAT,
    code: 'JTB-4973',
    price_cents: 58990,
    description:
      'Seja diretor de circo na América do fim do século XIX: recrute artistas e monte espetáculos pelas cidades para ganhar fama. Cidades com níveis de dificuldade diferentes oferecem recompensas e exigências variadas.',
    collections: ['estrategia'],
    specs: { players: '1-4', age: '12+', minutes: '80' },
    images: img(
      '90_3_ring_circus_1899_1_1a97345f5caa8ca718b67f8a9887840c.jpg',
      '90_3_ring_circus_1899_2_e40d893f4de459c34368377ab1543161.jpg',
      '90_3_ring_circus_1899_3_b6be46a68650682d0f422dd9ac38b78a.jpg',
      '90_3_ring_circus_1899_4_9a3b16c09ece3a98014b9b20aced0a34.jpg'
    ),
    weight_g: 2000,
  }),
  single({
    slug: 'a-aventura-do-ratinho',
    name: 'A Aventura do Ratinho',
    brand: 'Pony Corn',
    category: CAT,
    code: 'JTB-14805',
    price_cents: 35090,
    description:
      'Jogo cooperativo do Castelo Rá-Tim-Bum: ajude o Ratinho a recuperar os objetos roubados pelo Mau. Vença desafios de mímica, memória, música, desenho e conhecimentos gerais para conseguir os objetos e as recompensas.',
    collections: ['cooperativos', 'para-a-familia', 'castelo-ra-tim-bum'],
    specs: { players: '2-6', age: '7+' },
    images: img(
      '90_a_aventura_do_ratinho_1897_1_22d595371d76d4c0134b3098d6349d4b.jpg',
      '90_a_aventura_do_ratinho_1897_2_a7cf4feee0cd87f04d22cb7a51a133eb.jpg',
      '90_a_aventura_do_ratinho_1897_3_db7d9d34bbd0edc2234aadec68127e4c.jpg',
      '90_a_aventura_do_ratinho_1897_4_4dba5a9f0293b43f495c83084f6e18a5.jpg'
    ),
    weight_g: 1500,
  }),
  single({
    slug: 'expansaothe-red-cathedral-contractors',
    name: 'Expansão The Red Cathedral: Contractors',
    brand: 'Devir',
    category: CAT,
    code: 'JTB-681',
    price_cents: 30890,
    description:
      'Primeira expansão de The Red Cathedral: 10 novas guildas para combinar com as do jogo base e um novo tabuleiro com o mapa da Rússia, para enviar empreiteiros e recrutar especialistas de todas as regiões. São 30 formas diferentes de jogar.',
    collections: ['estrategia'],
    specs: { players: '1-4', age: '10+', minutes: '80' },
    images: img(
      '90_expansothe_red_cathedral_contractors_1_20251030153444_b34177f12353.jpg',
      '90_expansothe_red_cathedral_contractors_2_20251030153448_191cc45f1818.jpg',
      '90_expansothe_red_cathedral_contractors_3_20251030153449_78a6d350322d.jpg',
      '90_expansothe_red_cathedral_contractors_4_20251030153449_bc89239c02b8.jpg'
    ),
    weight_g: 700,
  }),
];
