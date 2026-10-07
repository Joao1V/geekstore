const onlyDigits = (value: string): string => value.replace(/\D/g, '');

const CPF_DIGITS = 11;
const CNPJ_DIGITS = 14;

/** CPF (000.000.000-00) até 11 dígitos; passou disso, vira CNPJ (00.000.000/0000-00). */
export function maskDocument(value: string): string {
  const digits = onlyDigits(value).slice(0, CNPJ_DIGITS);
  if (digits.length <= CPF_DIGITS) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5');
}

/** Telefone brasileiro: (11) 9999-9999 ou (11) 99999-9999. */
export function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  const area = `(${digits.slice(0, 2)}) `;
  const rest = digits.slice(2);
  if (rest.length <= 4) return `${area}${rest}`;
  const split = digits.length > 10 ? 5 : 4;
  return `${area}${rest.slice(0, split)}-${rest.slice(split)}`;
}
