import { productIssueSchema, productStatusSchema } from '@geekstore/shared';

// Os atalhos da listagem são status (ativo, rascunho, arquivado) ou problema (sem estoque, sem
// foto), nunca os dois ao mesmo tempo. Na URL ficam como `status=` ou `issue=`.
export type ChipId = 'all' | 'active' | 'draft' | 'archived' | 'out_of_stock' | 'no_photo';

export type ChipParams = { status: string | null; issue: string | null };

export function chipFromParams(status: string | null, issue: string | null): ChipId {
  const validIssue = productIssueSchema.safeParse(issue);
  if (validIssue.success) return validIssue.data;
  const validStatus = productStatusSchema.safeParse(status);
  return validStatus.success ? validStatus.data : 'all';
}

export function paramsFromChip(id: ChipId): ChipParams {
  if (id === 'out_of_stock' || id === 'no_photo') return { status: null, issue: id };
  return { status: id === 'all' ? null : id, issue: null };
}
