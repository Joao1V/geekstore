// O ERP guarda os nomes sem acento ("Mundo Magico", "Pocao"). Restaura os mais comuns do catálogo, só
// onde a forma sem acento não é outra palavra do português. Palavra fora da lista fica como está.
const ACCENTED: Readonly<Record<string, string>> = {
  pecas: 'peças',
  edicao: 'edição',
  magico: 'mágico',
  magica: 'mágica',
  acao: 'ação',
  animacao: 'animação',
  colecao: 'coleção',
  expansao: 'expansão',
  dragao: 'dragão',
  capitao: 'capitão',
  ingles: 'inglês',
  portugues: 'português',
  japones: 'japonês',
  herois: 'heróis',
  termica: 'térmica',
  termico: 'térmico',
  plastico: 'plástico',
  televisao: 'televisão',
  luminaria: 'luminária',
  cafe: 'café',
  coracao: 'coração',
  voce: 'você',
  bebe: 'bebê',
  familia: 'família',
  serie: 'série',
  historias: 'histórias',
  historia: 'história',
  fantastico: 'fantástico',
  classico: 'clássico',
  classica: 'clássica',
  ultimo: 'último',
  galaxia: 'galáxia',
  verao: 'verão',
  memorias: 'memórias',
  alem: 'além',
  guardioes: 'guardiões',
  profissoes: 'profissões',
  caminhao: 'caminhão',
  imperio: 'império',
  cabeca: 'cabeça',
  mascara: 'máscara',
  aniversario: 'aniversário',
  avancado: 'avançado',
  construcao: 'construção',
  excelencia: 'excelência',
  sintetica: 'sintética',
  acrilico: 'acrílico',
  aluminio: 'alumínio',
  adoravel: 'adorável',
  unicornio: 'unicórnio',
  cronicas: 'crônicas',
  icones: 'ícones',
  paginas: 'páginas',
  cancoes: 'canções',
  misterios: 'mistérios',
  cartao: 'cartão',
  zodiaco: 'zodíaco',
  fichario: 'fichário',
  diario: 'diário',
  diarios: 'diários',
  grifinoria: 'grifinória',
  calca: 'calça',
  alca: 'alça',
  pescoco: 'pescoço',
  translucido: 'translúcido',
  instantaneo: 'instantâneo',
  mosquetao: 'mosquetão',
  canecao: 'canecão',
  album: 'álbum',
  caca: 'caça',
  xicaras: 'xícaras',
  relogio: 'relógio',
  colecionavel: 'colecionável',
  evolucao: 'evolução',
  apotecaria: 'apotecária',
  pocao: 'poção',
  pocoes: 'poções',
  lilas: 'lilás',
  pais: 'país',
  tres: 'três',
  ate: 'até',
  ola: 'olá',
  nao: 'não',
  tambem: 'também',
};

const WORD = /[A-Za-z]+/g;

function matchCase(original: string, accented: string): string {
  if (original.length > 1 && original === original.toUpperCase()) return accented.toUpperCase();
  if (original.charAt(0) === original.charAt(0).toUpperCase()) {
    return accented.charAt(0).toUpperCase() + accented.slice(1);
  }
  return accented;
}

/** "Mundo Magico Harry Potter Pocao" -> "Mundo Mágico Harry Potter Poção" (só palavras da lista). */
export function restoreAccents(text: string): string {
  return text.replace(WORD, (word) => {
    const key = word.toLowerCase();
    // hasOwn: "constructor" ou "toString" num nome não podem casar com o protótipo do objeto.
    return Object.hasOwn(ACCENTED, key) ? matchCase(word, ACCENTED[key] as string) : word;
  });
}
