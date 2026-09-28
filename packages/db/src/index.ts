import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/client/index.js';

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);

export const prisma = new PrismaClient({ adapter });
export { PrismaClient } from '../generated/client/index.js';
