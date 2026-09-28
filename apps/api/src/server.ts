import { buildApp } from './app';
import { envConfig } from './core/config';

const app = buildApp();
const { PORT, HOST } = envConfig.server;

app.listen({ port: PORT, host: HOST }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
