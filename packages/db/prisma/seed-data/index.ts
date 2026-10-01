import { marketBoardGames } from './board-games-market';
import { storeBoardGames } from './board-games-store';
import { cardGames, tcgProducts } from './card-games';
import {
  apparelProducts,
  collectibleProducts,
  drinkwareProducts,
  legoProducts,
  mangaProducts,
} from './other-products';
import type { SeedProduct } from './types';

export { categories } from './categories';
export { collections } from './collections';
export type { SeedProduct } from './types';

// Jogos de tabuleiro primeiro: são o destaque do catálogo.
export const products: SeedProduct[] = [
  ...storeBoardGames,
  ...marketBoardGames,
  ...cardGames,
  ...tcgProducts,
  ...legoProducts,
  ...collectibleProducts,
  ...mangaProducts,
  ...apparelProducts,
  ...drinkwareProducts,
];
