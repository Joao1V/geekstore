import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z
    .string()
    .default('3333')
    .transform((val) => Number.parseInt(val, 10))
    .pipe(z.number().int().positive()),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().default(''),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET deve ter pelo menos 32 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z
    .string()
    .default('30')
    .transform((val) => Number.parseInt(val, 10))
    .pipe(z.number().int().positive()),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET deve ter pelo menos 32 caracteres'),
  REDIS_URL: z.string().default('redis://localhost:6381'),
});

export type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Erro na validação das variáveis de ambiente:');
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      console.error(`  - ${path}: ${issue.message}`);
    }
    throw new Error('Variáveis de ambiente inválidas');
  }

  return result.data;
}

export const envConfig = {
  get server() {
    const { NODE_ENV, PORT, HOST } = getEnv();
    return { NODE_ENV, PORT, HOST };
  },
  get cors() {
    const { CORS_ORIGINS } = getEnv();
    const origins = CORS_ORIGINS
      ? CORS_ORIGINS.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
      : [];
    return { ORIGINS: origins };
  },
  get jwt() {
    const { JWT_ACCESS_SECRET, JWT_ACCESS_EXPIRES_IN } = getEnv();
    return { ACCESS_SECRET: JWT_ACCESS_SECRET, ACCESS_EXPIRES_IN: JWT_ACCESS_EXPIRES_IN };
  },
  get cookie() {
    const { COOKIE_SECRET } = getEnv();
    return { SECRET: COOKIE_SECRET };
  },
  get auth() {
    const { REFRESH_TOKEN_TTL_DAYS } = getEnv();
    return { REFRESH_TOKEN_TTL_DAYS };
  },
  get redis() {
    const { REDIS_URL } = getEnv();
    return { URL: REDIS_URL };
  },
};
