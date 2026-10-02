import { type ProductIssue, productIssueSchema, productStatusSchema } from '@geekstore/shared';

// Os atalhos da listagem são status (ativo, rascunho, arquivado) ou problema (sem estoque, sem
// foto), nunca os dois ao mesmo tempo. Na URL ficam como `status=` ou `issue=`. As outras
// pendências (sem marca, sem peso...) chegam pelo painel e aparecem como um filtro avulso.
export type ChipId = 'all' | 'active' | 'draft' | 'archived' | 'out_of_stock' | 'no_photo';

export type ChipParams = { status: string | null; issue: string | null };

const CHIP_ISSUES: readonly ProductIssue[] = ['out_of_stock', 'no_photo'];
const isChipIssue = (issue: ProductIssue): issue is 'out_of_stock' | 'no_photo' =>
  CHIP_ISSUES.includes(issue);

export function parseIssue(issue: string | null): ProductIssue | null {
  const parsed = productIssueSchema.safeParse(issue);
  return parsed.success ? parsed.data : null;
}

export function chipFromParams(status: string | null, issue: string | null): ChipId {
  const validIssue = parseIssue(issue);
  if (validIssue && isChipIssue(validIssue)) return validIssue;
  const validStatus = productStatusSchema.safeParse(status);
  return validStatus.success ? validStatus.data : 'all';
}

/** Pendência que não tem atalho próprio (vira o aviso "Filtrando por…"). */
export function extraIssue(issue: string | null): ProductIssue | null {
  const validIssue = parseIssue(issue);
  return validIssue && !isChipIssue(validIssue) ? validIssue : null;
}

export function paramsFromChip(id: ChipId): ChipParams {
  if (id === 'out_of_stock' || id === 'no_photo') return { status: null, issue: id };
  return { status: id === 'all' ? null : id, issue: null };
}
