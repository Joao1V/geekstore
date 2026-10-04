import { slugify } from '../erp/text';

export type Franchise = {
  slug: string;
  name: string;
  /** Sigla de 3 letras (referência interna; não entra no SKU, que não carrega a franquia). */
  code: string;
  /** Palavras (sem acento, maiúsculas) que identificam a franquia no nome do item. */
  keywords: readonly string[];
};

const f = (name: string, code: string, keywords: string[]): Franchise => ({
  slug: slugify(name),
  name,
  code,
  keywords,
});

// Ordem importa: o primeiro que casar vence ("Disney Pixar Carros" é Disney; "Stranger Things" não é Netflix).
export const FRANCHISES: readonly Franchise[] = [
  f('Star Wars', 'STW', ['STAR WARS', 'MANDALORIAN', 'GROGU', 'DARTH VADER', 'YODA', 'JANGO FETT']),
  f('Harry Potter', 'HPT', [
    'HARRY POTTER',
    'MUNDO MAGICO',
    'WIZARDING WORLD',
    'HOGWARTS',
    'HEDWIG',
    'GRIFINORIA',
  ]),
  f('Stranger Things', 'STR', ['STRANGER THINGS']),
  f('Marvel', 'MRV', [
    'MARVEL',
    'HOMEM-ARANHA',
    'HOMEM ARANHA',
    'SPIDER-MAN',
    'SPIDER MAN',
    'VINGADORES',
    'X-MEN',
    'CAPITAO AMERICA',
    'IRON MAN',
    'HULK',
    'DEADPOOL',
    'PANTERA NEGRA',
    'GUARDIOES DA GALAXIA',
    'VENOM',
    'WOLVERINE',
    'THANOS',
  ]),
  f('DC Comics', 'DCC', [
    'DC COMICS',
    'BATMAN',
    'SUPERMAN',
    'LIGA DA JUSTICA',
    'MULHER MARAVILHA',
    'JOVENS TITAS',
    'ARLEQUINA',
    'CORINGA',
    'AQUAMAN',
    'FLASH',
    'DC',
  ]),
  f('Disney', 'DSN', [
    'DISNEY',
    'MICKEY',
    'MINNIE',
    'STITCH',
    'PIXAR',
    'TOY STORY',
    'FROZEN',
    'PRINCESA',
    'PRINCESAS',
    'POOH',
    'LILO',
    'MOANA',
    'ENCANTO',
    'DIVERTIDA MENTE',
    'VILLAINS',
    'ZOOTOPIA',
    'RATATOUILLE',
    'MONSTROS S.A',
    'CARROS DA DISNEY',
  ]),
  f('Pokémon', 'POK', ['POKEMON', 'PIKACHU', 'CHARIZARD']),
  f('Naruto', 'NAR', ['NARUTO', 'AKATSUKI', 'KAKASHI']),
  f('One Piece', 'OPC', ['ONE PIECE', 'LUFFY']),
  f('Dragon Ball', 'DRB', ['DRAGON BALL', 'GOKU', 'VEGETA']),
  f('Demon Slayer', 'DMS', ['DEMON SLAYER', 'KIMETSU', 'NEZUKO', 'TANJIRO']),
  f('Jujutsu Kaisen', 'JJK', ['JUJUTSU KAISEN', 'GOJO', 'ITADORI']),
  f('My Hero Academia', 'MHA', ['MY HERO ACADEMIA', 'HERO ACADEMIA', 'BOKU NO HERO']),
  f('Attack on Titan', 'AOT', ['ATTACK ON TITAN', 'SHINGEKI']),
  f('Death Note', 'DNT', ['DEATH NOTE']),
  f('Chainsaw Man', 'CSM', ['CHAINSAW MAN']),
  f('Spy x Family', 'SXF', ['SPY X FAMILY']),
  f('Super Mario', 'MAR', ['SUPER MARIO', 'MARIO KART', 'MARIO BROS', 'LUIGI', 'YOSHI', 'BOWSER']),
  f('Zelda', 'ZLD', ['ZELDA']),
  f('Sonic', 'SNC', ['SONIC']),
  f('Minecraft', 'MNC', ['MINECRAFT']),
  f('Hello Kitty e Sanrio', 'SAN', [
    'HELLO KITTY',
    'KUROMI',
    'CINNAMOROLL',
    'MY MELODY',
    'SANRIO',
    'POCHACCO',
  ]),
  f('Turma da Mônica', 'TDM', ['TURMA DA MONICA', 'MONICA', 'CEBOLINHA', 'CASCAO', 'MAGALI']),
  f('Snoopy e Peanuts', 'PNT', ['SNOOPY', 'PEANUTS', 'CHARLIE BROWN']),
  f('Looney Tunes', 'LOO', ['LOONEY TUNES', 'PATOLINO', 'PERNALONGA', 'TAZ']),
  f('Tom e Jerry', 'TJR', ['TOM E JERRY', 'TOM & JERRY', 'JERRY']),
  f('Bob Esponja', 'BOB', ['BOB ESPONJA']),
  f('Scooby-Doo', 'SCO', ['SCOOBY-DOO', 'SCOOBY DOO']),
  f('Garfield', 'GRF', ['GARFIELD']),
  f('Barbie', 'BRB', ['BARBIE']),
  f('Rápidos e Furiosos', 'FNF', [
    'FAST FURIOUS',
    'FAST & FURIOUS',
    'FAST AND FURIOUS',
    'RAPIDOS E FURIOSOS',
  ]),
  f('DreamWorks', 'DWK', ['DREAMWORKS', 'DRAGONS', 'SHREK', 'KUNG FU PANDA', 'MADAGASCAR']),
  f('Yu-Gi-Oh!', 'YGO', ['YUGIOH', 'YU-GI-OH', 'YU GI OH']),
  f('Magic: The Gathering', 'MTG', ['MAGIC THE GATHERING', 'MAGIC: THE GATHERING']),
  f('Dungeons & Dragons', 'DND', ['DUNGEONS', 'D&D']),
  f('Senhor dos Anéis', 'LOR', ['SENHOR DOS ANEIS', 'O HOBBIT']),
  f('Game of Thrones', 'GOT', ['GAME OF THRONES', 'TRONO DE FERRO']),
  f('Times de Futebol', 'FUT', [
    'CORINTHIANS',
    'PALMEIRAS',
    'SAO PAULO FUTEBOL',
    'FLAMENGO',
    'SANTOS FUTEBOL',
    'GREMIO',
    'VASCO',
    'FLUMINENSE',
  ]),
];

const asPattern = (keyword: string) =>
  new RegExp(`(^|[^A-Z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Z0-9])`);
const PATTERNS = FRANCHISES.map((franchise) => ({
  franchise,
  patterns: franchise.keywords.map((keyword) => ({ keyword, pattern: asPattern(keyword) })),
}));

/** Franquia citada no nome (texto já sem acento e em maiúsculas) e as palavras que a denunciaram. */
export function detectFranchise(
  plainUpperName: string
): { franchise: Franchise; matched: string } | null {
  for (const { franchise, patterns } of PATTERNS) {
    const hit = patterns.find(({ pattern }) => pattern.test(plainUpperName));
    if (hit) return { franchise, matched: hit.keyword };
  }
  return null;
}

/**
 * Palavras que SÃO o nome da franquia (saem do nome do modelo). Personagens ("Mickey", "Batman",
 * "Hulk") ficam: são eles que distinguem um produto do outro.
 */
export function franchiseWordsIn(plainUpperName: string, franchise: Franchise): Set<string> {
  const words = new Set<string>();
  const nameKeywords = franchise.keywords.filter(
    (keyword, index) => index === 0 || keyword.includes(' ') || keyword === 'DC'
  );
  for (const keyword of nameKeywords) {
    if (asPattern(keyword).test(plainUpperName)) {
      for (const word of keyword.split(/[^A-Z0-9]+/)) if (word) words.add(word);
    }
  }
  return words;
}
