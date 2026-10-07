// Limpeza por regra, só para o que é mecânico e seguro: tirar do FIM do nome os códigos de fabricante e de
// referência (HKH91-M7C5, #MXT004L-Dl, - YJ8358, CS2002). Não mexe em acento, erro de digitação nem
// franquia: isso é com a IA. Nunca toca em nome de LEGO (o número do set é o identificador).

export type RuleCleanResult = { name: string; removed: string[] };

// Códigos da Mattel/Hot Wheels/Matchbox: três letras e dois dígitos, com sufixo opcional (HKH91-M7C5, GRT01).
const MATTEL_CODE = /^[A-Z]{3}\d{2}(?:-[A-Z0-9]{3,6})?$/;
// Códigos de licenciados: pelo menos 3 letras e 3 dígitos, com sufixo opcional (DHNA9020-MK1, DQH070Y-TT1).
const LICENSED_CODE =
  /^(?:[A-Z]{3,5}\d{3,}[A-Z0-9]*(?:-[A-Za-z0-9]{1,5})?|[A-Z]{4,5}\d{2,}[A-Z0-9]*(?:-[A-Za-z0-9]{1,5})?|[A-Z]{3}\d{2}[A-Z]-[A-Za-z0-9]{1,5})$/;
// "#MXT004L-Dl", "#DYF23-MK1": hashtag seguida de código com letra e dígito.
const HASH_ALNUM = /^#(?=[A-Za-z0-9-]*[A-Za-z])(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}$/;
// "#31127", "#1902": hashtag com número longo (nunca em LEGO).
const HASH_NUMBER = /^#\d{4,}$/;
// Referência da Imaginarium: CS2002.
const CS_CODE = /^CS\d{3,5}$/;

const isCode = (token: string): boolean =>
  MATTEL_CODE.test(token) ||
  LICENSED_CODE.test(token) ||
  HASH_ALNUM.test(token) ||
  HASH_NUMBER.test(token) ||
  CS_CODE.test(token);

export function ruleClean(original: string): RuleCleanResult | null {
  if (/^LEGO\b/i.test(original)) return null;
  const tokens = original.trim().split(/\s+/);
  const removed: string[] = [];
  // Do fim para o começo: tira código, e também o traço, a barra ou "Cod" que o separava.
  while (tokens.length > 2) {
    const last = tokens[tokens.length - 1] as string;
    if (isCode(last)) {
      removed.unshift(tokens.pop() as string);
    } else if (/^[-–/]$/.test(last) || /^cod\.?$/i.test(last) || /^ref\.?:?$/i.test(last)) {
      tokens.pop();
    } else {
      break;
    }
  }
  const name = tokens
    .join(' ')
    .replace(/\s+[-–/]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return removed.length > 0 && name && name !== original ? { name, removed } : null;
}
