// CPF e CNPJ (RF-CLI-04): só dígitos, com o dígito verificador conferido.

export const onlyDigits = (value: string): string => value.replace(/\D/g, '');

const CPF_LENGTH = 11;
const CNPJ_LENGTH = 14;

const allEqual = (digits: string): boolean => /^(\d)\1+$/.test(digits);

function checkDigit(digits: string, weights: readonly number[]): number {
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(input: string): boolean {
  const digits = onlyDigits(input);
  if (digits.length !== CPF_LENGTH || allEqual(digits)) return false;
  const first = checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(digits[9]) && second === Number(digits[10]);
}

export function isValidCnpj(input: string): boolean {
  const digits = onlyDigits(input);
  if (digits.length !== CNPJ_LENGTH || allEqual(digits)) return false;
  const first = checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(digits[12]) && second === Number(digits[13]);
}

/** CPF ou CNPJ válido (com ou sem pontuação). */
export const isValidDocument = (input: string): boolean => isValidCpf(input) || isValidCnpj(input);

/** "12345678909" -> "123.456.789-09"; CNPJ também; o que não for documento volta como veio. */
export function formatDocument(input: string): string {
  const digits = onlyDigits(input);
  if (digits.length === CPF_LENGTH) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (digits.length === CNPJ_LENGTH) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return input;
}
