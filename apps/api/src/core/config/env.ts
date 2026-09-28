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
};
