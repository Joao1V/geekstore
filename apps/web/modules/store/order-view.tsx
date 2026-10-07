import { displayStatusLabels, maskPhone, type Order } from '@geekstore/shared';

import { formatBRL } from './lib/money';
import { ProductImage } from './product-image';

const TOTAL_ROW = 'flex justify-between gap-[15px] py-[6px] text-sm';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
export const formatOrderDate = (iso: string) => dateFormat.format(new Date(iso));

const TONE: Record<Order['display_status'], string> = {
  awaiting_payment: 'bg-status-warning/15 text-status-warning',
  paid: 'bg-status-info/15 text-status-info',
  picking: 'bg-status-info/15 text-status-info',
  shipped: 'bg-status-info/15 text-status-info',
  delivered: 'bg-status-success/15 text-status-success',
  cancelled: 'bg-status-error/15 text-status-error',
};

export function OrderStatusBadge({ status }: { status: Order['display_status'] }) {
  return (
    <span
      className={`${TONE[status]} inline-flex rounded-full px-3 py-1 text-xs font-extrabold uppercase`}
    >
      {displayStatusLabels[status]}
    </span>
  );
}

const ADDRESS_KEYS = [
  'street',
  'number',
  'complement',
  'neighborhood',
  'city',
  'state',
  'zip',
] as const;

function addressLines(address: Record<string, unknown>): string[] {
  const text = (key: (typeof ADDRESS_KEYS)[number]) => String(address[key] ?? '').trim();
  const first = [text('street'), text('number')].filter(Boolean).join(', ');
  const second = [text('complement'), text('neighborhood')].filter(Boolean).join(' · ');
  const third = [text('city'), text('state')].filter(Boolean).join(' – ');
  return [String(address.recipient ?? ''), first, second, `${third} · CEP ${text('zip')}`].filter(
    Boolean
  );
}

/** Itens, entrega, valores e rastreio de um pedido: serve à confirmação e ao histórico da conta. */
export function OrderView({ order }: { order: Order }) {
  return (
    <div className="grid gap-5">
      <div className="surface p-[22px]">
        <h2 className="mb-3 text-lg font-black">Itens</h2>
        {order.items.map((item) => (
          <div
            key={item.sku_id}
            className="grid grid-cols-[54px_1fr_auto] items-center gap-3 border-b border-border py-3 last:border-0"
          >
            <span className="block h-[67px] w-[54px] overflow-hidden rounded-lg">
              <ProductImage src={item.image_url} alt={item.name} />
            </span>
            <div className="min-w-0">
              <strong className="block text-sm leading-[1.35]">{item.name}</strong>
              {item.variant && <small className="block text-xs text-muted">{item.variant}</small>}
              <small className="text-xs text-muted">
                {item.quantity} × {formatBRL(item.unit_price_cents)}
              </small>
            </div>
            <strong className="text-sm">{formatBRL(item.total_cents)}</strong>
          </div>
        ))}
        <dl className="mt-4">
          <div className={TOTAL_ROW}>
            <dt>Subtotal</dt>
            <dd>{formatBRL(order.subtotal_cents)}</dd>
          </div>
          <div className={TOTAL_ROW}>
            <dt>Frete</dt>
            <dd>{order.shipping_cents ? formatBRL(order.shipping_cents) : 'Grátis'}</dd>
          </div>
          {order.discount_cents > 0 && (
            <div className={TOTAL_ROW}>
              <dt>Descontos{order.coupon_code ? ` (${order.coupon_code})` : ''}</dt>
              <dd>−{formatBRL(order.discount_cents)}</dd>
            </div>
          )}
          <div className={`${TOTAL_ROW} mt-2 border-t border-border pt-3 text-xl font-black`}>
            <dt>Total</dt>
            <dd>{formatBRL(order.total_cents)}</dd>
          </div>
        </dl>
      </div>
      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1">
        <div className="surface p-[22px]">
          <h2 className="mb-2 text-lg font-black">Entrega</h2>
          <p className="muted mb-2 text-sm">{order.shipping_service}</p>
          {addressLines(order.shipping_address).map((line) => (
            <p key={line} className="m-0 text-sm">
              {line}
            </p>
          ))}
          {order.shipments.map((shipment) => (
            <p key={shipment.tracking_code ?? shipment.carrier} className="mt-3 text-sm">
              <strong>{shipment.carrier}</strong>
              {shipment.tracking_code && (
                <>
                  {' '}
                  · rastreio <code className="font-mono">{shipment.tracking_code}</code>
                </>
              )}
            </p>
          ))}
        </div>
        <div className="surface p-[22px]">
          <h2 className="mb-2 text-lg font-black">Contato</h2>
          <p className="m-0 text-sm">{order.contact.name}</p>
          <p className="m-0 text-sm">{order.contact.email}</p>
          {order.contact.phone && <p className="m-0 text-sm">{maskPhone(order.contact.phone)}</p>}
          {order.cancel_reason && (
            <p className="mt-3 text-sm text-status-error">Cancelado: {order.cancel_reason}</p>
          )}
        </div>
      </div>
    </div>
  );
}
