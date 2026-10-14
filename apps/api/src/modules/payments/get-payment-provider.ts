import { envConfig } from '../../core/config/env';
import { mercadoPagoProvider } from './mercado-pago';
import { mockProvider, type PaymentProvider } from './payment-provider';

/** O provedor do ambiente: simulado por padrão, Mercado Pago com `PAYMENT_PROVIDER=mercadopago`. */
export function getPaymentProvider(): PaymentProvider {
  return envConfig.payments.PROVIDER === 'mercadopago' ? mercadoPagoProvider() : mockProvider;
}

/** O provedor de um pagamento já feito (um estorno vai para quem cobrou, mesmo que o padrão tenha mudado). */
export function providerFor(name: string): PaymentProvider {
  return name === 'mercadopago' ? mercadoPagoProvider() : mockProvider;
}
