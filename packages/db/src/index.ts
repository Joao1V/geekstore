import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/index.js';

// Sem `DATABASE_URL` o cliente só falha na primeira consulta, não ao importar o pacote: testes e
// código que só usam tipos ou `Prisma.sql` (sem banco) precisam importá-lo. Quem exige a variável
// é a API, que a valida no boot (`core/config/env.ts`).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
export { Prisma, PrismaClient } from '../generated/client/index.js';
export * from './attribute-catalog';
export * from './ensure-attribute-catalog';
