import { FALLBACK_CATEGORY_SLUG, isKnownCategory } from '@geekstore/db';

// Classifica um item do ERP na NOSSA taxonomia (packages/db/src/category-catalog.ts). O nome do item
// do ERP começa quase sempre pelo TIPO ("MANGA ...", "CANECA ...", "MINIATURA ..."), então a palavra
// inicial e algumas palavras-chave decidem com segurança. Só quando nada casa entra a categoria que o
// ERP já tinha (grupo/subgrupo), e o que continuar sem pista vai para "A classificar" (revisão).

export type Classification = {
  slug: string;
  /** Como foi decidido: pela palavra-chave do nome, pela categoria do ERP, ou sem pista. */
  how: 'name' | 'erp' | 'none';
};

type Context = {
  /** Nome em maiúsculas, sem acento, pontuação virando espaço, com espaço nas pontas. */
  text: string;
  words: string[];
  first: string;
  /** Subgrupo do ERP normalizado (sem acento nem #). */
  erpSub: string;
  erpGroup: string;
};

const plain = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

const has = (context: Context, pattern: RegExp): boolean => pattern.test(context.text);
const firstIn = (context: Context, words: readonly string[]): boolean =>
  words.includes(context.first);

// Palavras que só embalam o tipo ("KIT ALMOFADA ...", "CONJUNTO DE DADOS ..."): o tipo é a próxima.
const WRAPPER_WORDS: ReadonlySet<string> = new Set([
  'KIT',
  'KITS',
  'CONJUNTO',
  'COMBO',
  'PAR',
  'MINI',
  'DE',
  'DO',
  'DA',
  'DOS',
  'DAS',
]);

type Rule = readonly [slug: string, test: (context: Context) => boolean];

// Ordem importa. Regra geral: o TIPO do produto (camiseta, mochila, estojo...) vence a marca/tema
// ("ESTOJO HOT WHEELS" é papelaria, não miniatura; "CAMISETA LEGO" é camiseta), e o específico vence
// o genérico (protetor de cartas antes de "cartas").
const TCG_BRANDS =
  / (POKEMON|MAGIC|YU GI OH|YUGIOH|DIGIMON|DRAGON BALL SUPER CARD|ONE PIECE CARD|LORCANA|DISNEY LORCANA) /;

const NAME_RULES: readonly Rule[] = [
  // Livros
  ['mangas', (c) => firstIn(c, ['MANGA', 'MANGAS'])],
  ['hqs', (c) => firstIn(c, ['HQ', 'HQS', 'GRAPHIC', 'GIBI', 'GIBIS'])],
  // Acessórios de jogo (antes de cartas e livros: "estojo para cartas", "álbum para cartas")
  [
    'acessorios-de-jogo',
    (c) =>
      firstIn(c, ['PROTETOR', 'PROTETORES', 'FICHARIO', 'DADO', 'DADOS', 'PLAYMAT']) ||
      has(c, / DECK BOX /) ||
      has(c, / (TAPETE|TAPETES) (PARA|DE) JOGOS? /) ||
      has(c, / TUBO PARA TAPETE /) ||
      has(c, / (DIVISOR|DIVISORES) DE DECK /) ||
      has(c, / PAGINAS PARA FICHARIO /) ||
      has(c, / ELASTICO PARA JOGO /) ||
      has(c, / BANDEJA DE DADOS /) ||
      (firstIn(c, ['ESTOJO', 'ALBUM', 'PORTA']) &&
        has(c, / (CARTA|CARTAS|DECK|CARDS|TCG|MAGIC|POKEMON|YU GI OH) /)),
  ],
  [
    'livros',
    (c) =>
      firstIn(c, [
        'LIVRO',
        'LIVROS',
        'ALBUM',
        'REVISTA',
        'GUIA',
        'ENCICLOPEDIA',
        'FIGURINHA',
        'FIGURINHAS',
      ]),
  ],
  ['rpg', (c) => has(c, / R P G | RPG /) || c.erpSub.includes('R P G')],
  // Jogos e cartas ("JOGO ... CARD GAME" é jogo; "KIT ONE PIECE CARD GAME" são cartas)
  ['jogos-de-tabuleiro', (c) => firstIn(c, ['JOGO', 'JOGOS', 'EXPANSAO', 'EXPANSOES'])],
  [
    'cartas-e-baralhos',
    (c) =>
      firstIn(c, [
        'BOOSTER',
        'DECK',
        'BLISTER',
        'BARALHO',
        'STARTER',
        'BUNDLE',
        'COMMANDER',
        'TCG',
        'CARTAS',
      ]) ||
      has(c, / (BOOSTER|BARALHO|CARD GAME) /) ||
      (firstIn(c, ['BOX', 'LATA', 'COLECAO', 'TIN']) && has(c, TCG_BRANDS)),
  ],
  ['quebra-cabecas', (c) => has(c, / QUEBRA CABECAS? /)],
  // Moda
  [
    'moda-pet',
    (c) =>
      has(c, / PETS? /) &&
      firstIn(c, ['CAMISETA', 'ROUPA', 'BANDANA', 'FANTASIA', 'CAPA', 'COLEIRA', 'CAMA']),
  ],
  [
    'camisetas',
    (c) =>
      firstIn(c, [
        'CAMISETA',
        'CAMISETAS',
        'CAMISA',
        'REGATA',
        'BLUSA',
        'BABYLOOK',
        'POLO',
        'BODY',
      ]),
  ],
  [
    'agasalhos',
    (c) => firstIn(c, ['MOLETOM', 'JAQUETA', 'CASACO', 'BLUSAO', 'CASAQUINHO', 'COLETE', 'CORTA']),
  ],
  ['pijamas', (c) => firstIn(c, ['PIJAMA', 'PIJAMAS', 'CAMISOLA', 'ROBE', 'KIGURUMI', 'MACACAO'])],
  ['acessorios-de-moda', (c) => has(c, / MASCARA DE DORMIR /)],
  [
    'fantasias',
    (c) =>
      firstIn(c, [
        'FANTASIA',
        'FANTASIAS',
        'MANTO',
        'CAPA',
        'MASCARA',
        'PERUCA',
        'COSPLAY',
        'SAIA',
        'PALETO',
      ]),
  ],
  [
    'calcados-e-pantufas',
    (c) =>
      firstIn(c, [
        'PANTUFA',
        'PANTUFAS',
        'CHINELO',
        'CHINELOS',
        'TENIS',
        'SANDALIA',
        'CALCADO',
        'SAPATO',
        'BOTA',
        'SLIDE',
      ]),
  ],
  ['meias', (c) => firstIn(c, ['MEIA', 'MEIAS', 'SAPATILHA'])],
  // Bolsas
  ['mochilas', (c) => firstIn(c, ['MOCHILA', 'MOCHILAS', 'MOCHILETE', 'MOCHILETES'])],
  ['malas', (c) => firstIn(c, ['MALA', 'MALAS', 'MALETA'])],
  [
    'carteiras-e-necessaires',
    (c) =>
      firstIn(c, ['CARTEIRA', 'CARTEIRAS', 'NECESSAIRE']) ||
      has(c, / PORTA (CARTAO|CARTOES|DOCUMENTOS?|CELULAR|MOEDAS|PASSAPORTE) /),
  ],
  [
    'bolsas',
    (c) =>
      firstIn(c, [
        'BOLSA',
        'BOLSAS',
        'SACOLA',
        'PASTA',
        'SHOULDER',
        'BAG',
        'BOLSINHA',
        'FRASQUEIRA',
      ]),
  ],
  // Casa
  ['canecas', (c) => firstIn(c, ['CANECA', 'CANECAS', 'XICARA', 'XICARAS'])],
  [
    'copos-e-garrafas',
    (c) =>
      firstIn(c, [
        'COPO',
        'COPOS',
        'GARRAFA',
        'GARRAFAS',
        'SQUEEZE',
        'TERMICA',
        'TERMICO',
        'CUIA',
        'TACA',
        'JARRA',
        'CANECAO',
        'CANTIL',
        'COQUETELEIRA',
        'ABRIDOR',
      ]),
  ],
  ['almofadas', (c) => firstIn(c, ['ALMOFADA', 'ALMOFADAS', 'TRAVESSEIRO', 'MANTA', 'COBERTOR'])],
  [
    'decoracao-e-iluminacao',
    (c) =>
      has(c, / PORTA (RETRATOS?|JOIAS|OBJETOS|VELAS|CHAVES|COPOS|TREM) /) ||
      firstIn(c, [
        'ENFEITE',
        'LUMINARIA',
        'LIGHT',
        'ABAJUR',
        'QUADRO',
        'POSTER',
        'TAPETE',
        'RELOGIO',
        'VASO',
        'CORTINA',
        'LUSTRE',
        'ESTATUETA',
        'DECORACAO',
        'PLACA',
        'BANDEIRA',
        'COFRE',
        'VARINHA',
        'CAPACHO',
        'APARADOR',
        'LIXEIRA',
        'SALEIRO',
        'AROMATIZADOR',
        'ORGANIZADOR',
        'ESSENCIA',
      ]),
  ],
  [
    'cozinha-e-lancheiras',
    (c) =>
      firstIn(c, [
        'LANCHEIRA',
        'POTE',
        'MARMITA',
        'PRATO',
        'TALHER',
        'TABUA',
        'AVENTAL',
        'FORMA',
        'COZINHA',
        'BOWL',
        'FACA',
        'BULE',
        'CORTADOR',
      ]),
  ],
  // Papelaria
  [
    'papelaria-e-escritorio',
    (c) =>
      firstIn(c, [
        'CADERNO',
        'CANETA',
        'LAPIS',
        'MARCADOR',
        'ESTOJO',
        'AGENDA',
        'AGENDINHA',
        'PLANNER',
        'DIARIO',
        'CARIMBO',
        'CARTAO',
        'ADESIVO',
        'APONTADOR',
        'BORRACHA',
        'REGUA',
        'ETIQUETA',
        'CALCULADORA',
      ]) || has(c, / PORTA (LAPIS|CANETAS?) /),
  ],
  // Eletrônicos
  [
    'eletronicos-e-gadgets',
    (c) =>
      firstIn(c, [
        'FONE',
        'CARREGADOR',
        'MOUSEPAD',
        'ADAPTADOR',
        'SPEAKER',
        'PILHA',
        'MASSAGEADOR',
        'UMIDIFICADOR',
        'ESTERILIZADOR',
        'CLIMATIZADOR',
        'PARAFUSADEIRA',
        'TAMAGOTCHI',
      ]) && !has(c, / (CARTAS|DECK) /),
  ],
  // Alimentos
  [
    'alimentos-e-guloseimas',
    (c) =>
      firstIn(c, [
        'REFRIGERANTE',
        'BALA',
        'BALAS',
        'DOCE',
        'CHOCOLATE',
        'SUCO',
        'SNACK',
        'SALGADINHO',
        'BISCOITO',
        'PIRULITO',
        'CHICLETE',
        'PUDIM',
        'GELEIA',
        'MACARRAO',
        'CEREAL',
        'BEBIDA',
        'CHA',
        'CAFE',
      ]),
  ],
  ['pelucias', (c) => firstIn(c, ['PELUCIA', 'PELUCIAS']) || has(c, / PELUCIA /)],
  ['brinquedos-e-hobbies', (c) => firstIn(c, ['BRINQUEDO', 'BRINQUEDOS', 'BEYBLADE', 'PIAO'])],
  // Frases que decidem sozinhas, depois de todos os tipos (uma caneca "de vinho" já virou caneca acima)
  ['livros', (c) => has(c, / FIGURINHAS? /) || (firstIn(c, ['BOX']) && has(c, / ALBUM /))],
  ['cozinha-e-lancheiras', (c) => has(c, / (VINHO|CHEF) /)],
  ['papelaria-e-escritorio', (c) => has(c, / SELO DE CARTAS /)],
  ['carteiras-e-necessaires', (c) => has(c, / PASSAPORTE /)],
  ['malas', (c) => firstIn(c, ['TAG']) && has(c, / MALA /)],
  ['decoracao-e-iluminacao', (c) => has(c, / JARDINAGEM /)],
  [
    'eletronicos-e-gadgets',
    (c) =>
      has(c, / SPEAKER /) ||
      (firstIn(c, ['SUPORTE']) && has(c, / CELULAR /)) ||
      firstIn(c, ['BASE', 'CONTROLE', 'KARAOKE', 'FERRAMENTA', 'FERRAMENTAS', 'MULTIUSO']),
  ],
  ['alimentos-e-guloseimas', (c) => firstIn(c, ['GOMA', 'PRIULITO']) || has(c, / DANCLETS /)],
  ['acessorios-de-jogo', (c) => firstIn(c, ['CAIXA']) && has(c, TCG_BRANDS)],
  ['eletronicos-e-gadgets', (c) => firstIn(c, ['CAIXA']) && has(c, / (SOM|BLUETOOTH) /)],
  ['decoracao-e-iluminacao', (c) => firstIn(c, ['CAIXA', 'BAU'])],
  ['almofadas', (c) => firstIn(c, ['TOALHA', 'TOALHAS', 'ROUPAO'])],
  ['brinquedos-e-hobbies', (c) => firstIn(c, ['IOIO'])],
  // Marca no nome (depois dos tipos: uma camiseta LEGO continua sendo camiseta)
  ['lego', (c) => has(c, / LEGO /)],
  ['funko', (c) => has(c, / FUNKO /)],
  // Colecionáveis genéricos
  [
    'acessorios-de-moda',
    (c) =>
      firstIn(c, [
        'BONE',
        'CHAPEU',
        'GORRO',
        'TOUCA',
        'LUVA',
        'LUVAS',
        'CACHECOL',
        'CINTO',
        'GRAVATA',
        'BOINA',
        'TIARA',
        'BRINCO',
        'COLAR',
        'PULSEIRA',
        'ANEL',
        'OCULOS',
        'CHAVEIRO',
        'CHAVEIROS',
        'PIN',
        'FUNPIN',
        'BOTTON',
        'BROCHE',
        'BANDANA',
        'GUARDA',
      ]),
  ],
  [
    'miniaturas-e-veiculos',
    (c) =>
      firstIn(c, ['MINIATURA', 'MINIATURAS', 'CARRINHO', 'CARRO', 'VEICULO']) ||
      has(c, / MINIATURAS? /) ||
      has(c, / (HOT WHEELS|HOTWHEELS|MAJORETTE|GREENLIGHT|MATCHBOX) /),
  ],
  [
    'bonecos-e-figuras',
    (c) =>
      firstIn(c, [
        'BONECO',
        'BONECA',
        'BONECOS',
        'FIGURA',
        'FIGURAS',
        'FIGURE',
        'ACTION',
        'ESTATUA',
        'BUSTO',
        'BLIND',
      ]),
  ],
  [
    'blocos-de-montar',
    (c) => has(c, / (BLOCOS|BLOCKS|BLOCO|METAL EARTH) /) || firstIn(c, ['BLOCOS', 'BLOCKS']),
  ],
];

// Quando o nome não ajuda, a categoria que o ERP já tinha (subgrupo) é uma boa pista.
const ERP_SUBGROUP_FALLBACK: Readonly<Record<string, string>> = {
  MANGA: 'mangas',
  HQ: 'hqs',
  LIVRO: 'livros',
  'JOGOS DE CARTAS': 'cartas-e-baralhos',
  'JOGOS DE TABULEIRO': 'jogos-de-tabuleiro',
  'JOGOS DE MESA': 'jogos-de-tabuleiro',
  'JOGOS DE R P G': 'rpg',
  'QUEBRA CABECA': 'quebra-cabecas',
  'CARRINHOS E VEICULOS DE BRINQUEDO': 'miniaturas-e-veiculos',
  'MONTAVEIS DESMONTAVEIS': 'blocos-de-montar',
  BONECO: 'bonecos-e-figuras',
  'ACESSORIOS EXPANCOES': 'acessorios-de-jogo',
  'BRINQUEDOS EDUCATIVOS': 'brinquedos-e-hobbies',
  PELUCIA: 'pelucias',
  CAMISETAS: 'camisetas',
  PIJAMAS: 'pijamas',
  'FANTASIA GEEK': 'fantasias',
  CALCADOS: 'calcados-e-pantufas',
  MEIAS: 'meias',
  'PARA PETS': 'moda-pet',
  'ACESSORIOS DE MODA': 'acessorios-de-moda',
  MOCHILA: 'mochilas',
  BOLSA: 'bolsas',
  CARTEIRA: 'carteiras-e-necessaires',
  'MALA DE VIAGEM': 'malas',
  ALMOFADA: 'almofadas',
  ENFEITE: 'decoracao-e-iluminacao',
  'ILUMINACAO E DECORACAO': 'decoracao-e-iluminacao',
  PAPELARIA: 'papelaria-e-escritorio',
  'UTENCILIOS DE BEBIDAS': 'copos-e-garrafas',
  'UTENSILIOS DE BEBIDAS': 'copos-e-garrafas',
  'UTENSILIOS PARA ALIMENTACAO': 'cozinha-e-lancheiras',
  'ALIMENTOS IMPORTADOS': 'alimentos-e-guloseimas',
  BEBIDAS: 'alimentos-e-guloseimas',
};

export function classifyItem(input: {
  name: string;
  erpGroup: string;
  erpSub: string | null;
}): Classification {
  const text = plain(input.name);
  const words = text.split(' ').filter(Boolean);
  const context: Context = {
    text: ` ${text} `,
    words,
    first: words.find((word) => !WRAPPER_WORDS.has(word)) ?? words[0] ?? '',
    erpSub: plain(input.erpSub ?? ''),
    erpGroup: plain(input.erpGroup),
  };

  for (const [slug, test] of NAME_RULES) {
    if (test(context)) return { slug: assertKnown(slug), how: 'name' };
  }
  const fromErp = ERP_SUBGROUP_FALLBACK[context.erpSub];
  if (fromErp) return { slug: assertKnown(fromErp), how: 'erp' };
  return { slug: FALLBACK_CATEGORY_SLUG, how: 'none' };
}

function assertKnown(slug: string): string {
  if (!isKnownCategory(slug))
    throw new Error(`Regra de classificação aponta para categoria inexistente: ${slug}`);
  return slug;
}
