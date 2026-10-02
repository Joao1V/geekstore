// Catálogo de atributos de variação da Geek Store (cor, tamanho, edição...). É a fonte única: o seed,
// o importador do ERP e os testes criam os atributos a partir daqui (ver ensure-attribute-catalog.ts).
// `suffix` é o código curto do valor, que vira o final do SKU (ex.: CAM-01 + AZ + M = CAM-01-AZ-M).

export type AttributeValueSeed = { label: string; suffix: string; hex?: string };
export type AttributeSeed = { code: string; name: string; values: AttributeValueSeed[] };

const v = (label: string, suffix: string, hex?: string): AttributeValueSeed => ({
  label,
  suffix,
  ...(hex ? { hex } : {}),
});

export const ATTRIBUTE_CATALOG: readonly AttributeSeed[] = [
  {
    code: 'cor',
    name: 'Cor',
    values: [
      v('Preto', 'PT', '#111111'),
      v('Branco', 'BC', '#FFFFFF'),
      v('Off White', 'OW', '#F2EFE6'),
      v('Cinza', 'CZ', '#8A8F98'),
      v('Grafite', 'GF', '#3A3D42'),
      v('Azul', 'AZ', '#1F5FBF'),
      v('Azul Marinho', 'MR', '#14213D'),
      v('Verde', 'VD', '#2E8B57'),
      v('Amarelo', 'AM', '#F5C400'),
      v('Laranja', 'LJ', '#F28C28'),
      v('Vermelho', 'VM', '#D62828'),
      v('Vinho', 'VN', '#6D1A36'),
      v('Rosa', 'RS', '#F28CB1'),
      v('Roxo', 'RX', '#6A2C91'),
      v('Lilás', 'LL', '#B79CED'),
      v('Marrom', 'MA', '#6B4226'),
      v('Bege', 'BG', '#D9C7A3'),
      v('Dourado', 'DO', '#C9A227'),
      v('Prata', 'PR', '#C0C0C0'),
      v('Marfim', 'MF', '#FFFFF0'),
      v('Carbono', 'CB', '#2B2B2B'),
      v('Transparente', 'TR'),
      v('Translúcido', 'TL'),
      v('Colorido', 'CL'),
    ],
  },
  {
    code: 'tamanho',
    name: 'Tamanho',
    values: [
      v('PP', 'PP'),
      v('P', 'P'),
      v('M', 'M'),
      v('G', 'G'),
      v('GG', 'GG'),
      v('XG', 'XG'),
      v('XGG', 'XGG'),
      v('Único', 'U'),
      v('Pequeno', 'PEQ'),
      v('Médio', 'MED'),
      v('Grande', 'GRD'),
    ],
  },
  {
    code: 'tamanho_infantil',
    name: 'Tamanho infantil',
    values: ['RN', '1', '2', '3', '4', '6', '8', '10', '12', '14', '16'].map((size) =>
      v(size, size)
    ),
  },
  {
    code: 'numeracao',
    name: 'Numeração',
    values: ['34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44'].map((n) => v(n, n)),
  },
  {
    code: 'edicao',
    name: 'Edição',
    values: [
      v('Padrão', 'STD'),
      v('Chase', 'CHS'),
      v('Glow in the Dark', 'GLW'),
      v('Metálico', 'MET'),
      v('Flocked', 'FLK'),
      v('Diamond', 'DIA'),
      v('Exclusiva', 'EXC'),
      v('Edição Limitada', 'LIM'),
      v('Colecionador', 'COL'),
      v('Deluxe', 'DLX'),
    ],
  },
  {
    code: 'idioma',
    name: 'Idioma',
    values: [v('Português', 'PT'), v('Inglês', 'EN'), v('Espanhol', 'ES'), v('Japonês', 'JP')],
  },
  {
    code: 'formato',
    name: 'Formato',
    values: [
      v('Brochura', 'BRO'),
      v('Capa Dura', 'CPD'),
      v('Edição de Bolso', 'BLS'),
      v('Box', 'BOX'),
      v('Digital', 'DIG'),
    ],
  },
  {
    code: 'escala',
    name: 'Escala',
    values: ['1:6', '1:12', '1:18', '1:24', '1:32', '1:43', '1:64'].map((s) =>
      v(s, s.replace(':', ''))
    ),
  },
  {
    code: 'apresentacao',
    name: 'Apresentação',
    values: [
      v('Unidade', 'UN'),
      v('Booster', 'BST'),
      v('Deck', 'DCK'),
      v('Display', 'DSP'),
      v('Caixa', 'CX'),
      v('Kit', 'KIT'),
    ],
  },
  {
    code: 'material',
    name: 'Material',
    values: [
      v('Algodão', 'ALG'),
      v('Poliéster', 'POL'),
      v('Couro', 'COU'),
      v('Sintético', 'SIN'),
      v('Madeira', 'MAD'),
      v('Metal', 'MTL'),
      v('Aço Inox', 'INX'),
      v('Plástico', 'PLA'),
      v('PVC', 'PVC'),
      v('Vidro', 'VID'),
      v('Cerâmica', 'CER'),
      v('Silicone', 'SIL'),
      v('Pelúcia', 'PEL'),
      v('Resina', 'RES'),
    ],
  },
  {
    code: 'sabor',
    name: 'Sabor',
    values: [
      v('Original', 'ORI'),
      v('Natural', 'NAT'),
      v('Chocolate', 'CHO'),
      v('Morango', 'MOR'),
      v('Baunilha', 'BAU'),
      v('Limão', 'LIM'),
      v('Uva', 'UVA'),
      v('Laranja', 'LAR'),
      v('Cereja', 'CER'),
      v('Pêssego', 'PES'),
      v('Maçã', 'MAC'),
      v('Maracujá', 'MAR'),
      v('Manga', 'MAN'),
      v('Menta', 'MEN'),
      v('Caramelo', 'CAR'),
      v('Coco', 'COC'),
      v('Abacaxi', 'ABA'),
      v('Leite', 'LEI'),
    ],
  },
  {
    code: 'peso',
    name: 'Peso',
    values: ['100g', '250g', '500g', '1kg', '2kg', '5kg'].map((w) => v(w, w.toUpperCase())),
  },
  {
    code: 'capacidade',
    name: 'Capacidade',
    values: ['200ml', '250ml', '300ml', '350ml', '400ml', '500ml', '600ml', '1L', '2L', '5L'].map(
      (c) => v(c, c.toUpperCase())
    ),
  },
  {
    code: 'voltagem',
    name: 'Voltagem',
    values: [v('110V', '110'), v('220V', '220'), v('Bivolt', 'BIV')],
  },
  {
    code: 'embalagem',
    name: 'Embalagem',
    values: [
      v('Lata', 'LT'),
      v('Garrafa', 'GR'),
      v('Pet', 'PET'),
      v('Pacote', 'PCT'),
      v('Sachê', 'SCH'),
    ],
  },
];

/** `Azul Marinho` -> `azul-marinho`; `33/35` -> `33-35`. É o código estável do valor. */
export function valueCodeOf(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const MAX_SUFFIX = 12;
const SUFFIX_LETTERS = 3;

/** Sufixo de SKU para um valor fora do catálogo: 3 letras ("Turquesa" -> TUR) ou o próprio código ("80g" -> 80G). */
export function deriveSuffix(label: string): string {
  const code = valueCodeOf(label).toUpperCase();
  const compact = code.replace(/-/g, '');
  const suffix =
    /^[A-Z]+$/.test(compact) && compact.length > SUFFIX_LETTERS
      ? compact.slice(0, SUFFIX_LETTERS)
      : code;
  return suffix.slice(0, MAX_SUFFIX) || 'X';
}

const SUFFIXES = new Map(
  ATTRIBUTE_CATALOG.flatMap((attribute) =>
    attribute.values.map((value) => [`${attribute.code}:${valueCodeOf(value.label)}`, value.suffix])
  )
);

/** Sufixo do catálogo para `atributo + rótulo`, ou o derivado quando o valor não está nele. */
export function suffixFor(attributeCode: string, label: string): string {
  return SUFFIXES.get(`${attributeCode}:${valueCodeOf(label)}`) ?? deriveSuffix(label);
}
