import { buildApp } from './app';
import { envConfig } from './core/config';
import { startOutboxPipeline } from './modules/notifications/outbox-pipeline';
import { expirePendingOrders } from './modules/orders/order-flow';
import { reconcileStock } from './modules/stock/stock-reconciliation';

const EXPIRY_CHECK_MS = 60_000;
const RECONCILE_EVERY_MS = 6 * 60 * 60 * 1000;
const RECONCILE_FIRST_RUN_MS = 2 * 60_000;

const app = buildApp();
const { PORT, HOST } = envConfig.server;

app
  .listen({ port: PORT, host: HOST })
  .then(() => {
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
    startOutboxPipeline(app);

    // Conferência periódica entre o saldo e o histórico de movimentações (RF-EST-10).
    const reconcile = () =>
      reconcileStock()
        .then((rows) => {
          if (rows.length > 0) app.log.warn({ count: rows.length }, 'estoque divergente');
        })
        .catch((error: unknown) => app.log.error(error, 'falha na conferência de estoque'));
    setTimeout(reconcile, RECONCILE_FIRST_RUN_MS).unref();
    setInterval(reconcile, RECONCILE_EVERY_MS).unref();
  })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
