const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

/** Datas vêm em UTC (ISO 8601); a interface mostra no fuso da loja. */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

const integerFormatter = new Intl.NumberFormat('pt-BR');

/** 26095 -> "26.095". */
export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

const compactBrlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Centavos em reais, completo: 5990 -> "R$ 59,90". */
export function formatBRL(cents: number): string {
  return brlFormatter.format(cents / 100);
}

/** Valor grande em reais, curto: 701568828 centavos -> "R$ 7 mi". */
export function formatBRLCompact(cents: number): string {
  return compactBrlFormatter.format(cents / 100);
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Campo de formulário vazio vira `null` no contrato da API. */
export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** ISO UTC -> texto do `datetime-local` no fuso do navegador ("2026-12-31T23:59"); vazio sem data. */
export function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** O caminho de volta: texto do `datetime-local` (fuso do navegador) -> ISO UTC; vazio vira `null`. */
export function fromDateTimeLocal(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
