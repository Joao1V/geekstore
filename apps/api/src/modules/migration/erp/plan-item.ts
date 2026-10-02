import { detectBrand } from './brand-detect';
import type { ErpRow } from './erp-row';
import { isValidGtin } from './gtin';
import { normalizeMeasures } from './measures';
import type { Issue, IssueCode, PlannedItem, Promo, Skipped } from './plan-types';
import { cleanDescription, cleanGroupName, normalizeName, slugify } from './text';

const EXCLUDED_GROUPS = new Set(['USO E CONSUMO', 'SERVIÇOS', 'EMBALAGENS']);
const MAX_NAME_LENGTH = 255;
const MAX_PHOTO_URL_LENGTH = 500;
const NCM_PATTERN = /^\d{8}$/;

export type RowDraft = {
  item: Omit<
    PlannedItem,
    'slug' | 'categoryKey' | 'skuCode' | 'productKey' | 'productCode' | 'attributes' | 'erpName'
  > & {
    baseSlug: string;
    groupName: string;
    subName: string | null;
  };
  issues: Issue[];
};

export type RowResult = { skipped: Skipped } | { draft: RowDraft };

const toCents = (reais: number): number => Math.round(reais * 100);

function parseDate(value: string | null, endOfDay: boolean): Date | null {
  if (!value) return null;
  const date = new Date(
    value.length === 10 ? `${value}T${endOfDay ? '23:59:59' : '00:00:00'}Z` : value
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

type PromoPlan = { promo: Promo | null; issues: IssueCode[] };

function planPromo(row: ErpRow, priceCents: number, now: Date): PromoPlan {
  if (!row.preco_promocao || row.preco_promocao <= 0) return { promo: null, issues: [] };
  const promoCents = toCents(row.preco_promocao);
  if (promoCents >= priceCents) return { promo: null, issues: ['promo_invalid'] };

  const startsAt = parseDate(row.promocao_inicio, false);
  const endsAt = parseDate(row.promocao_fim, true);
  if (endsAt && endsAt < now) return { promo: null, issues: ['promo_expired'] };

  const promo = { priceCents: promoCents, compareAtCents: priceCents, startsAt, endsAt };
  return { promo, issues: startsAt || endsAt ? [] : ['promo_perpetual'] };
}

function planPhotos(urls: string[]): { photos: string[]; issues: IssueCode[] } {
  const photos = [...new Set(urls.map((url) => url.trim()))].filter(
    (url) => /^https?:\/\//i.test(url) && url.length <= MAX_PHOTO_URL_LENGTH
  );
  return {
    photos,
    issues: [
      ...(photos.length === 0 ? (['no_photo'] as const) : []),
      ...(photos.some((url) => url.startsWith('http:')) ? (['photo_not_https'] as const) : []),
    ],
  };
}

function planStock(estoque: number | null): { stock: number; issues: IssueCode[]; detail: string } {
  if (estoque === null)
    return { stock: 0, issues: ['stock_missing'], detail: 'sem estoque informado' };
  if (estoque < 0) return { stock: 0, issues: ['stock_negative'], detail: String(estoque) };
  return { stock: Math.round(estoque), issues: [], detail: '' };
}

function legacyData(row: ErpRow): Record<string, unknown> {
  const { fotos: _fotos, descricao_detalhada: _descricao, ...rest } = row;
  return rest;
}

const isExcludedGroup = (group: string): boolean =>
  EXCLUDED_GROUPS.has(cleanGroupName(group).toUpperCase());

/** Uma linha do ERP -> item planejado (ou o motivo de ficar de fora). Sem efeitos colaterais. */
export function planRow(row: ErpRow, now: Date): RowResult {
  const legacyCode = String(row.codigo);
  const name = normalizeName(row.nome).slice(0, MAX_NAME_LENGTH);

  if (isExcludedGroup(row.grupo)) {
    return {
      skipped: { legacyCode, name, reason: 'group_excluded', detail: cleanGroupName(row.grupo) },
    };
  }
  if (!row.preco_venda || row.preco_venda <= 0) {
    return { skipped: { legacyCode, name, reason: 'no_price', detail: String(row.preco_venda) } };
  }

  const priceCents = toCents(row.preco_venda);
  const measures = normalizeMeasures({
    weightKg: row.peso_bruto_kg,
    height: row.altura,
    width: row.largura,
    length: row.comprimento,
  });
  const promo = planPromo(row, priceCents, now);
  const photos = planPhotos(row.fotos);
  const stock = planStock(row.estoque);

  const ean = row.codigo_barras && isValidGtin(row.codigo_barras) ? row.codigo_barras : null;
  const ncm = row.ncm && NCM_PATTERN.test(row.ncm) ? row.ncm : null;
  const skuStatus = stock.stock > 0 ? 'active' : 'inactive';

  const found: [IssueCode, string][] = [
    ...measures.issues.map((code): [IssueCode, string] => [code, '']),
    ...promo.issues.map((code): [IssueCode, string] => [
      code,
      row.preco_promocao ? String(row.preco_promocao) : '',
    ]),
    ...photos.issues.map((code): [IssueCode, string] => [code, String(photos.photos.length)]),
    ...stock.issues.map((code): [IssueCode, string] => [code, stock.detail]),
    ...(row.codigo_barras && !ean
      ? [['ean_invalid', row.codigo_barras] as [IssueCode, string]]
      : []),
    ...(row.ncm && !ncm ? [['ncm_invalid', row.ncm] as [IssueCode, string]] : []),
  ];

  return {
    draft: {
      issues: found.map(([code, detail]) => ({ legacyCode, code, detail })),
      item: {
        legacyCode,
        name,
        baseSlug: slugify(name) || `produto-${legacyCode}`,
        description: cleanDescription(row.descricao_detalhada),
        groupName: cleanGroupName(row.grupo),
        subName: row.subgrupo ? cleanGroupName(row.subgrupo) : null,
        // Só publica o que tem estoque (SKU ativo) e foto; o resto fica em rascunho para revisão.
        productStatus: skuStatus === 'active' && photos.photos.length > 0 ? 'active' : 'draft',
        skuStatus,
        ean,
        manufacturerCode: row.codigo_fabricante ? row.codigo_fabricante.slice(0, 60) : null,
        brandName: detectBrand(name),
        ncm,
        weightG: measures.weightG,
        lengthMm: measures.lengthMm,
        widthMm: measures.widthMm,
        heightMm: measures.heightMm,
        priceCents,
        promo: promo.promo,
        stock: stock.stock,
        photos: photos.photos,
        legacyData: legacyData(row),
      },
    },
  };
}
