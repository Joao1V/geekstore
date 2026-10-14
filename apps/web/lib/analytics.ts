// Eventos de e-commerce para o GA4 e o Meta Pixel (RF-CHK-05). Só disparam com o consentimento da
// pessoa (LGPD) e se o ID do serviço estiver configurado: sem isso, `trackEvent` não faz nada.

export const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID ?? '';
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '';
export const ANALYTICS_ENABLED = GA4_ID !== '' || META_PIXEL_ID !== '';

const CONSENT_KEY = 'geekstore-consent';
const CENTS_PER_REAL = 100;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
  }
}

export type AnalyticsItem = {
  id: string;
  name: string;
  variant?: string;
  priceCents: number;
  quantity: number;
};

type EventName =
  | 'view_item'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'add_shipping_info'
  | 'add_payment_info'
  | 'purchase'
  | 'search';

const META_EVENTS: Record<EventName, string> = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  add_shipping_info: 'AddShippingInfo',
  add_payment_info: 'AddPaymentInfo',
  purchase: 'Purchase',
  search: 'Search',
};

export type TrackPayload = {
  items?: readonly AnalyticsItem[];
  valueCents?: number;
  transactionId?: string;
  searchTerm?: string;
};

export function hasConsent(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch {
    return false;
  }
}

export function saveConsent(granted: boolean): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
  } catch {
    // Sem armazenamento (janela privada): a escolha vale só até recarregar.
  }
}

export function consentChoice(): 'granted' | 'denied' | null {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

const reais = (cents: number): number => cents / CENTS_PER_REAL;

export function trackEvent(name: EventName, payload: TrackPayload = {}): void {
  if (!ANALYTICS_ENABLED || typeof window === 'undefined' || !hasConsent()) return;
  const items = payload.items ?? [];
  const value = payload.valueCents === undefined ? undefined : reais(payload.valueCents);

  window.gtag?.('event', name, {
    currency: 'BRL',
    value,
    transaction_id: payload.transactionId,
    search_term: payload.searchTerm,
    items: items.map((item) => ({
      item_id: item.id,
      item_name: item.name,
      item_variant: item.variant,
      price: reais(item.priceCents),
      quantity: item.quantity,
    })),
  });

  window.fbq?.('track', META_EVENTS[name], {
    currency: 'BRL',
    value,
    search_string: payload.searchTerm,
    content_type: 'product',
    content_ids: items.map((item) => item.id),
    contents: items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      item_price: reais(item.priceCents),
    })),
    num_items: items.reduce((sum, item) => sum + item.quantity, 0) || undefined,
  });
}
