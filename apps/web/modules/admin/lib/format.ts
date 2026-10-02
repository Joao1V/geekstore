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
