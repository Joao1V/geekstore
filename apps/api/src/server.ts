import { buildApp } from './app';
import { envConfig } from './core/config';
import { expirePendingOrders } from './modules/orders/order-flow';

const EXPIRY_CHECK_MS = 60_000;

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
  })
  .catch((error: unknown) => {
    app.log.error(error);
    process.exit(1);
  });
