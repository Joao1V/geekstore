import { type DisplayStatus, displayStatusLabels } from '@geekstore/shared';

import { Badge } from '../ui/badge';

const TONE: Record<DisplayStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  awaiting_payment: 'warning',
  paid: 'info',
  picking: 'info',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'error',
};

export function OrderStatusBadge({ status }: { status: DisplayStatus }) {
  return <Badge tone={TONE[status]}>{displayStatusLabels[status]}</Badge>;
}

export const ORDER_STATUS_CHIPS = [
  { id: 'all', label: 'Todos' },
  ...(Object.keys(displayStatusLabels) as DisplayStatus[]).map((id) => ({
    id,
    label: displayStatusLabels[id],
  })),
];
