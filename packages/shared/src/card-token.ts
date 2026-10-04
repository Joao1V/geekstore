// Tokenização SIMULADA do cartão (RNF-07: nenhum dado de cartão passa pelo servidor). O número é
// conferido aqui, no navegador, e só o token viaja. Com o gateway real, quem faz isto é o SDK dele.
// Cartões de teste: 4242 4242 4242 4242 aprova; qualquer um terminado em 0002 (ex.: 4000 0000 0000 0002) recusa.

const MIN_DIGITS = 13;
const MAX_DIGITS = 19;
const DECLINED_SUFFIX = '0002';

/** Dígito verificador de Luhn: pega a maioria dos erros de digitação do número do cartão. */
export function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let value = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
  }
  return sum % 10 === 0;
}

/** O token do cartão, ou `null` se o número for inválido. Não guarda o número em lugar nenhum. */
export function mockCardToken(cardNumber: string): string | null {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS || !passesLuhn(digits)) return null;
  const last4 = digits.slice(-4);
  return `mock_tok_${last4 === DECLINED_SUFFIX ? 'declined' : 'approved'}_${last4}`;
}

/** "12/28" ou "1228" -> válido se for um mês de 01 a 12 que ainda não passou. */
export function isFutureExpiry(value: string, now = new Date()): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 4) return false;
  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2));
  if (month < 1 || month > 12) return false;
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}
