import type { SeedCollection } from './types';

export const collections: SeedCollection[] = [
  // Curadoria (jogos de tabuleiro em destaque)
  {
    slug: 'novos-drops',
    name: 'Novos Drops',
    kind: 'curated',
    featured: true,
    description: 'Os lançamentos mais recentes da loja.',
  },
  {
    slug: 'cooperativos',
    name: 'Cooperativos',
    kind: 'curated',
    featured: true,
    description: 'Todos jogam juntos contra o jogo.',
  },
  {
    slug: 'estrategia',
    name: 'Estratégia',
    kind: 'curated',
    featured: true,
    description: 'Para quem gosta de planejar cada turno.',
  },
  {
    slug: 'para-dois-jogadores',
    name: 'Para Dois Jogadores',
    kind: 'curated',
    description: 'Duelos e jogos pensados para duas pessoas.',
  },
  {
    slug: 'jogos-rapidos',
    name: 'Jogos Rápidos',
    kind: 'curated',
    description: 'Partidas de até 30 minutos.',
  },
  {
    slug: 'para-a-familia',
    name: 'Para a Família',
    kind: 'curated',
    description: 'Regras simples e diversão para todas as idades.',
  },
  {
    slug: 'classicos-modernos',
    name: 'Clássicos Modernos',
    kind: 'curated',
    description: 'Jogos que definiram o hobby nas últimas décadas.',
  },
  {
    slug: 'party-games',
    name: 'Party Games',
    kind: 'curated',
    description: 'Para animar a mesa com muita gente.',
  },
  // Universos de jogos de tabuleiro
  { slug: 'catan', name: 'Catan', kind: 'franchise' },
  { slug: 'carcassonne', name: 'Carcassonne', kind: 'franchise' },
  { slug: 'terraforming-mars', name: 'Terraforming Mars', kind: 'franchise' },
  { slug: 'root', name: 'Root', kind: 'franchise' },
  { slug: 'imperium', name: 'Imperium', kind: 'franchise' },
  { slug: 'exit', name: 'Exit', kind: 'franchise' },
  { slug: 'king-of-tokyo', name: 'King of Tokyo', kind: 'franchise' },
  // Franquias geek
  { slug: 'one-piece', name: 'One Piece', kind: 'franchise' },
  { slug: 'harry-potter', name: 'Harry Potter', kind: 'franchise' },
  { slug: 'dragon-ball', name: 'Dragon Ball', kind: 'franchise' },
  { slug: 'disney', name: 'Disney', kind: 'franchise' },
  { slug: 'hello-kitty', name: 'Hello Kitty', kind: 'franchise' },
  { slug: 'sonic', name: 'Sonic', kind: 'franchise' },
  { slug: 'castelo-ra-tim-bum', name: 'Castelo Rá-Tim-Bum', kind: 'franchise' },
  { slug: 'goonies', name: 'Os Goonies', kind: 'franchise' },
  { slug: 'made-in-abyss', name: 'Made in Abyss', kind: 'franchise' },
];
