export type Product = {
  id: number;
  slug: string;
  name: string;
  category: string;
  universe: string;
  price: number;
  previousPrice?: number;
  stock: number;
  image: string;
  description: string;
  specs: Record<string, string>;
  sizes?: string[];
  badge: string;
};
export const products: Product[] = [
  {
    id: 1,
    slug: 'controle-wireless-neon',
    name: 'Controle Wireless Edição Neon',
    category: 'Games',
    universe: 'Gaming Series',
    price: 349.9,
    previousPrice: 399.9,
    stock: 18,
    badge: 'Novo drop',
    image:
      'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1000&q=85',
    description:
      'Uma nova fase para o seu setup. Controle com design ergonômico para acompanhar suas próximas aventuras.',
    specs: {
      Coleção: 'Gaming Series',
      Condição: 'Novo',
      Conteúdo: '1 controle • catálogo demonstrativo',
    },
  },
  {
    id: 2,
    slug: 'figure-ronin-flame',
    name: 'Figure Ronin Flame — 18 cm',
    category: 'Colecionáveis',
    universe: 'Anime',
    price: 219.9,
    stock: 7,
    badge: 'Para sua coleção',
    image:
      'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=1000&q=85',
    description:
      'Um novo personagem para a sua estante. Peça demonstrativa da coleção Ronin Saga; imagem ilustrativa, a substituir pela fotografia real antes da venda.',
    specs: {
      Coleção: 'Ronin Saga',
      Altura: '18 cm',
      Conteúdo: 'Figure e base • dados demonstrativos',
    },
  },
  {
    id: 3,
    slug: 'moletom-city-guardian',
    name: 'Moletom City Guardian',
    category: 'Vestuário',
    universe: 'Heróis',
    price: 179.9,
    previousPrice: 224.9,
    stock: 12,
    badge: 'Oferta',
    sizes: ['P', 'M', 'G', 'GG'],
    image:
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=1000&q=85',
    description:
      'Seu universo favorito também faz parte do seu dia a dia. Moletom com capuz, modelagem casual e visual urbano.',
    specs: {
      Coleção: 'Hero District',
      Modelagem: 'Unissex',
      Cuidados: 'Consultar etiqueta • produto demonstrativo',
    },
  },
  {
    id: 4,
    slug: 'dados-arcanos-metal',
    name: 'Dados Arcanos — Metal Set',
    category: 'RPG',
    universe: 'Arcane Quest',
    price: 129.9,
    stock: 4,
    badge: 'Nova aventura',
    image:
      'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=1000&q=85',
    description:
      'Prepare sua próxima campanha. Conjunto demonstrativo de dados para transformar cada rodada em uma nova história.',
    specs: {
      Coleção: 'Arcane Quest',
      Categoria: 'Acessórios para RPG',
      Conteúdo: 'Conjunto de dados • imagem ilustrativa',
    },
  },
];
export const money = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const pixPrice = (value: number) => Math.round((Math.round(value * 100) * 95) / 100) / 100;
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function matches(product: Product, term: string) {
  const synonyms: Record<string, string> = {
    'homem aranha': 'spider man',
    figura: 'figure',
    boneco: 'figure',
    roupa: 'vestuario',
    jogo: 'games',
  };
  const query = normalize(term).trim();
  const alias = synonyms[query] || query;
  const haystack = normalize(`${product.name} ${product.category} ${product.universe}`);
  return haystack.includes(query) || haystack.includes(alias);
}
export const catalogService = { list: async (): Promise<Product[]> => products };
