import { XMLParser } from 'fast-xml-parser';

import { isValidGtin } from '../migration/erp/gtin';

export class NfeParseError extends Error {}

export type ParsedNfeItem = {
  line: number;
  supplierCode: string | null;
  description: string;
  ean: string | null;
  ncm: string | null;
  quantity: number;
  unitCostCents: number;
  totalCostCents: number;
};

export type ParsedNfe = {
  accessKey: string;
  number: string | null;
  series: string | null;
  issuedAt: Date | null;
  supplier: { document: string | null; name: string };
  totalCents: number;
  items: ParsedNfeItem[];
};

// Tudo como texto: EAN e NCM começam com zero e não podem virar número.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  isArray: (name) => name === 'det',
});

const ACCESS_KEY = /^\d{44}$/;
const DIGITS = /\D/g;

const text = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
};

const toCents = (value: unknown, what: string): number => {
  const parsed = Number(text(value));
  if (!Number.isFinite(parsed) || parsed < 0) throw new NfeParseError(`Valor inválido em ${what}.`);
  return Math.round(parsed * 100);
};

/** GTIN válido ou `null` ("SEM GTIN", vazio e dígito verificador errado não valem). */
function gtinOf(value: unknown): string | null {
  const digits = text(value)?.replace(DIGITS, '') ?? '';
  return digits && isValidGtin(digits) ? digits : null;
}

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw => (value && typeof value === 'object' ? (value as Raw) : {});

function parseItem(det: Raw, index: number): ParsedNfeItem {
  const line = Number(det['@_nItem'] ?? index + 1);
  const prod = obj(det.prod);
  const description = text(prod.xProd);
  if (!description) throw new NfeParseError(`O item ${line} não tem descrição.`);

  const quantity = Number(text(prod.qCom));
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new NfeParseError(
      `O item ${line} (${description}) tem quantidade ${text(prod.qCom) ?? 'vazia'}: só aceito quantidades inteiras.`
    );
  }
  const totalCostCents = toCents(prod.vProd, `o item ${line}`);
  const ncm = text(prod.NCM)?.replace(DIGITS, '');
  return {
    line,
    supplierCode: text(prod.cProd),
    description,
    ean: gtinOf(prod.cEAN) ?? gtinOf(prod.cEANTrib),
    ncm: ncm && ncm.length === 8 ? ncm : null,
    quantity,
    unitCostCents: Math.round(totalCostCents / quantity),
    totalCostCents,
  };
}

/** Lê o XML de uma NF-e (com ou sem o envelope `nfeProc`). Lança `NfeParseError` com a causa em português. */
export function parseNfe(xml: string): ParsedNfe {
  let tree: Raw;
  try {
    tree = obj(parser.parse(xml));
  } catch {
    throw new NfeParseError('O arquivo não é um XML válido.');
  }
  const nfe = obj(obj(tree.nfeProc).NFe ?? tree.NFe);
  const info = obj(nfe.infNFe);
  if (Object.keys(info).length === 0) {
    throw new NfeParseError('Não encontrei uma NF-e neste XML (esperava a tag infNFe).');
  }

  const accessKey = text(info['@_Id'])?.replace(/^NFe/, '') ?? '';
  if (!ACCESS_KEY.test(accessKey)) throw new NfeParseError('A chave de acesso da nota é inválida.');

  const ide = obj(info.ide);
  const emit = obj(info.emit);
  const dets = (Array.isArray(info.det) ? info.det : []) as Raw[];
  if (dets.length === 0) throw new NfeParseError('A nota não tem itens.');

  const issued = text(ide.dhEmi) ?? text(ide.dEmi);
  const issuedAt = issued && !Number.isNaN(Date.parse(issued)) ? new Date(issued) : null;
  const document =
    text(emit.CNPJ)?.replace(DIGITS, '') ?? text(emit.CPF)?.replace(DIGITS, '') ?? null;
  const items = dets.map(parseItem);
  return {
    accessKey,
    number: text(ide.nNF),
    series: text(ide.serie),
    issuedAt,
    supplier: { document, name: text(emit.xNome) ?? 'Fornecedor sem nome' },
    totalCents: toCents(
      obj(obj(info.total).ICMSTot).vNF ?? items.reduce((s, i) => s + i.totalCostCents, 0) / 100,
      'o total'
    ),
    items,
  };
}
