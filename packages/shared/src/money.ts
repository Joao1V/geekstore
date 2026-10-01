/** Dinheiro é sempre centavos, inteiro. Estas são as únicas conversões do projeto. */

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(cents: number): string {
  return brlFormatter.format(cents / 100);
}

/** Converte reais digitados ("349,90" ou 349.9) em centavos, sem passar por float acumulado. */
export function toCents(reais: number | string): number {
  const normalized = typeof reais === 'string' ? reais.replace(/\./g, '').replace(',', '.') : reais;
  return Math.round(Number(normalized) * 100);
}
