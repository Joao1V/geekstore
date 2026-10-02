// Marcas que aparecem no NOME dos itens do ERP (o export não traz a marca em coluna própria).
// Só entram marcas inequívocas: "Estrela" ou "Grow" também são palavras comuns ("Minha Estrela
// Preferida"), então ficam de fora; marca errada é pior do que marca ausente.

const KNOWN_BRANDS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'Funko', pattern: /\bfunko\b/ },
  { name: 'LEGO', pattern: /\blego\b/ },
  { name: 'Konami', pattern: /\bkonami\b/ },
  { name: 'Copag', pattern: /\bcopag\b/ },
  { name: 'Bandai', pattern: /\bbandai\b/ },
  { name: 'Mattel', pattern: /\bmattel\b/ },
  { name: 'Hasbro', pattern: /\bhasbro\b/ },
  { name: 'Panini', pattern: /\bpanini\b/ },
  { name: 'Devir', pattern: /\bdevir\b/ },
  { name: 'Galápagos', pattern: /\bgalapagos\b/ },
  { name: 'Moonster', pattern: /\bmoonster\b/ },
  { name: 'Paper Games', pattern: /\bpaper ?games\b/ },
];

const plain = (text: string): string => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A marca citada no nome do item, ou `null` quando não há uma inequívoca. */
export function detectBrand(name: string): string | null {
  const text = plain(name);
  return KNOWN_BRANDS.find((brand) => brand.pattern.test(text))?.name ?? null;
}
