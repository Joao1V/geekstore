const VALID_LENGTHS = new Set([8, 12, 13, 14]);

/** GTIN válido: só dígitos, 8/12/13/14 de comprimento e dígito verificador correto. */
export function isValidGtin(value: string): boolean {
  if (!/^\d+$/.test(value) || !VALID_LENGTHS.has(value.length)) return false;
  if (/^(\d)\1+$/.test(value)) return false; // 0000000000000, 1111111111111...
  const digits = [...value].map(Number);
  const check = digits.pop() as number;
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
