import { toCsv } from './csv';
import type { ErpSource } from './erp-source';
import type { CatalogPlan, IssueCode } from './plan-types';

export type ReportFile = { name: string; content: string };

const NAME_SAMPLE_SIZE = 300;

function countBy<T>(values: T[], key: (value: T) => string): Record<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(key(value), (counts.get(key(value)) ?? 0) + 1);
  return Object.fromEntries(counts);
}

function summary(plan: CatalogPlan, source: ErpSource, now: Date) {
  const { items } = plan;
  return {
    gerado_em: now.toISOString(),
    arquivo_sha256: source.sha256,
    linhas_no_arquivo: source.total,
    linhas_invalidas: source.invalid.length,
    a_importar: items.length,
    produtos: new Set(items.map((i) => i.productKey)).size,
    produtos_com_variacoes: new Set(
      items.filter((i) => i.productKey.startsWith('family:')).map((i) => i.productKey)
    ).size,
    pulados: countBy(plan.skipped, (s) => s.reason),
    skus_em_produto_publicado: items.filter((i) => i.productStatus === 'active').length,
    skus_em_produto_rascunho: items.filter((i) => i.productStatus === 'draft').length,
    skus_inativos_sem_estoque: items.filter((i) => i.skuStatus === 'inactive').length,
    categorias: {
      raizes: plan.categories.filter((c) => c.parentKey === null).length,
      subcategorias: plan.categories.filter((c) => c.parentKey !== null).length,
    },
    estoque_total_unidades: items.reduce((sum, i) => sum + i.stock, 0),
    com_promocao: items.filter((i) => i.promo).length,
    com_ean_valido: items.filter((i) => i.ean).length,
    com_peso: items.filter((i) => i.weightG !== null).length,
    com_dimensoes: items.filter((i) => i.lengthMm !== null).length,
    com_ncm_valido: items.filter((i) => i.ncm).length,
    com_descricao: items.filter((i) => i.description).length,
    fotos_total: items.reduce((sum, i) => sum + i.photos.length, 0),
    pendencias_por_tipo: countBy(plan.issues, (issue) => issue.code),
  };
}

const ISSUE_LABELS: Record<IssueCode, string> = {
  weight_missing: 'Peso ausente ou zero',
  weight_placeholder: 'Peso de preenchimento (1 kg com 1x1x1)',
  dims_missing: 'Dimensões ausentes ou zero',
  dims_placeholder: 'Dimensões de preenchimento (1x1x1)',
  dims_suspect: 'Dimensões em unidade duvidosa (parecem metros)',
  ean_invalid: 'Código de barras inválido (não é GTIN)',
  ean_duplicate: 'Código de barras repetido em outros itens',
  ncm_invalid: 'NCM inválido (não tem 8 dígitos)',
  stock_negative: 'Estoque negativo (importado como 0)',
  stock_missing: 'Estoque não informado (importado como 0)',
  no_photo: 'Sem foto (fica em rascunho)',
  photo_not_https: 'Foto em http (sem criptografia)',
  promo_expired: 'Promoção vencida (ignorada)',
  promo_invalid: 'Promoção não é menor que o preço (ignorada)',
  promo_perpetual: 'Promoção sem datas (aplicada sem prazo)',
  slug_collision: 'Nome repetido (endereço recebeu o código do ERP)',
  variant_ambiguous: 'Duas variações iguais (mesma cor e tamanho): não agrupado, revisar',
};

function nameSample(plan: CatalogPlan): string[][] {
  const step = Math.max(1, Math.floor(plan.items.length / NAME_SAMPLE_SIZE));
  return plan.items
    .filter((_, index) => index % step === 0)
    .map((item) => [item.legacyCode, (item.legacyData as { nome?: string }).nome ?? '', item.name]);
}

/** Relatórios para o cliente aprovar antes da carga (RF-MIG-02). Pura: só monta texto. */
export function buildReport(plan: CatalogPlan, source: ErpSource, now: Date): ReportFile[] {
  const nameOf = new Map(plan.items.map((item) => [item.legacyCode, item.name]));
  const categoryName = new Map(plan.categories.map((c) => [c.key, c.name]));

  return [
    { name: 'resumo.json', content: `${JSON.stringify(summary(plan, source, now), null, 2)}\n` },
    {
      name: 'categorias.csv',
      content: toCsv(
        ['nivel', 'nome', 'endereco', 'categoria_pai', 'produtos'],
        plan.categories.map((c) => [
          c.parentKey ? 2 : 1,
          c.name,
          c.slug,
          c.parentKey ? categoryName.get(c.parentKey) : '',
          c.productCount,
        ])
      ),
    },
    {
      name: 'pulados.csv',
      content: toCsv(
        ['codigo_erp', 'nome', 'motivo', 'detalhe'],
        plan.skipped.map((s) => [
          s.legacyCode,
          s.name,
          s.reason === 'no_price' ? 'Sem preço' : 'Grupo fora da loja',
          s.detail,
        ])
      ),
    },
    {
      name: 'pendencias.csv',
      content: toCsv(
        ['codigo_erp', 'nome', 'pendencia', 'detalhe'],
        plan.issues.map((i) => [
          i.legacyCode,
          nameOf.get(i.legacyCode) ?? '',
          ISSUE_LABELS[i.code],
          i.detail,
        ])
      ),
    },
    {
      name: 'ean-duplicados.csv',
      content: toCsv(
        ['codigo_de_barras', 'itens', 'codigos_erp', 'nomes'],
        plan.duplicateEans.map((d) => [
          d.ean,
          d.legacyCodes.length,
          d.legacyCodes.join(' '),
          d.legacyCodes.map((c) => nameOf.get(c)).join(' | '),
        ])
      ),
    },
    {
      name: 'nomes-amostra.csv',
      content: toCsv(['codigo_erp', 'nome_original', 'nome_novo'], nameSample(plan)),
    },
    {
      name: 'skus-e-variacoes.csv',
      content: toCsv(
        ['sku', 'produto', 'cor', 'tamanho', 'codigo_erp', 'nome_no_erp'],
        plan.items.map((i) => [
          i.skuCode,
          i.name,
          i.attributes.cor ?? '',
          i.attributes.tamanho ?? '',
          i.legacyCode,
          i.erpName,
        ])
      ),
    },
    {
      name: 'linhas-invalidas.csv',
      content: toCsv(
        ['linha', 'codigo', 'problema'],
        source.invalid.map((r) => [r.index, r.codigo, r.problem])
      ),
    },
  ];
}
