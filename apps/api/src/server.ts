import { buildApp } from './app';
import { envConfig } from './core/config';
import { notifyBackInStock } from './modules/engagement/engagement.service';
import { expirePendingOrders } from './modules/orders/order-flow';
import { reconcileStock } from './modules/stock/stock-reconciliation';

const EXPIRY_CHECK_MS = 60_000;
const BACK_IN_STOCK_EVERY_MS = 5 * 60_000;
const RECONCILE_EVERY_MS = 6 * 60 * 60 * 1000;
const RECONCILE_FIRST_RUN_MS = 2 * 60_000;

const app = buildApp();
const { PORT, HOST } = envConfig.server;

app
  .listen({ port: PORT, host: HOST })
  .then(() => {
    // Pagamento simulado aprova qualquer "cartão de teste": em produção isso é venda de graça.
    if (envConfig.server.NODE_ENV === 'production' && envConfig.payments.PROVIDER === 'mock') {
      app.log.warn(
        'PAYMENT_PROVIDER=mock em produção: os pagamentos NÃO são reais. Use mercadopago.'
      );
    }
    // Pedido cujo pagamento não chegou a tempo é cancelado e a reserva volta ao estoque. Num só
    // processo basta este temporizador; com várias instâncias, o UPDATE condicional evita trabalho
    // duplicado, e a fila (BullMQ) assume quando existir (RF-PLA-02).
    const timer = setInterval(() => {
      expirePendingOrders()
        .then((count) => {
          if (count > 0) app.log.info({ count }, 'pedidos sem pagamento expirados');
        })
        .catch((error: unknown) => app.log.error(error, 'falha ao expirar pedidos'));
    }, EXPIRY_CHECK_MS);
    timer.unref();
    // Conferência periódica entre o saldo e o histórico de movimentações (RF-EST-10).
    const reconcile = () =>
      reconcileStock()
        .then((rows) => {
          if (rows.length > 0) app.log.warn({ count: rows.length }, 'estoque divergente');
        })
        .catch((error: unknown) => app.log.error(error, 'falha na conferência de estoque'));
    // "Avise-me": quando um SKU esgotado volta, dispara o e-mail de quem pediu (RF-VIT-09).
    setInterval(() => {
      notifyBackInStock()
        .then((count) => {
          if (count > 0) app.log.info({ count }, 'avisos de volta ao estoque enviados ao outbox');
        })
        .catch((error: unknown) => app.log.error(error, 'falha nos avisos de volta ao estoque'));
    }, BACK_IN_STOCK_EVERY_MS).unref();
    setTimeout(reconcile, RECONCILE_FIRST_RUN_MS).unref();
    setInterval(reconcile, RECONCILE_EVERY_MS).unref();
  })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
