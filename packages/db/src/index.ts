import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/client/index.js';

const databaseUrl = new URL(process.env.DATABASE_URL as string);

// MySQL 8 usa caching_sha2_password por padrão. Sem TLS, o handshake precisa buscar a
// chave pública RSA do servidor pra criptografar a senha — sem essa flag o driver
// mariadb falha com ER_CANNOT_RETRIEVE_RSA_KEY (visto na prática: conexão travando por
// ~10-20s até estourar timeout, tanto no MySQL local quanto no de produção no Dokploy).
// Rede interna confiável (Docker), então buscar a chave pública sem TLS é aceitável aqui.
const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port) || 3306,
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.replace(/^\//, ''),
  allowPublicKeyRetrieval: true,
});

export const prisma = new PrismaClient({ adapter });
export { PrismaClient } from '../generated/client/index.js';
