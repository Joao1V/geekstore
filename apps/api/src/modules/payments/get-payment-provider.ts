import { envConfig } from '../../core/config/env';
import { mercadoPagoProvider } from './mercado-pago';
import { mockProvider, type PaymentProvider } from './payment-provider';

/** O provedor do ambiente: simulado por padrão, Mercado Pago com `PAYMENT_PROVIDER=mercadopago`. */
export function getPaymentProvider(): PaymentProvider {
  return envConfig.payments.PROVIDER === 'mercadopago' ? mercadoPagoProvider() : mockProvider;
}
