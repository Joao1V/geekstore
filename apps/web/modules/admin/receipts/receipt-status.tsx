import type { ReceiptSummary } from '@geekstore/shared';

import { Badge } from '../ui/badge';

export function ReceiptStatusBadge({ status }: { status: ReceiptSummary['status'] }) {
  return status === 'posted' ? (
    <Badge tone="success">Lançada</Badge>
  ) : (
    <Badge tone="warning">Rascunho</Badge>
  );
}
