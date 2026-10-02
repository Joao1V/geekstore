// CSV para abrir direto no Excel em português: separador `;` e BOM UTF-8 (acentos corretos).
const BOM = '﻿';

function cell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return `${BOM}${[header, ...rows].map((line) => line.map(cell).join(';')).join('\n')}\n`;
}
