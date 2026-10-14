import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z
      .string()
      .default('3333')
      .transform((val) => Number.parseInt(val, 10))
      .pipe(z.number().int().positive()),
    HOST: z.string().default('0.0.0.0'),
    // Lida pelo pacote @geekstore/db (que não valida): a API falha cedo aqui. Recusa `mysql://` de
    // propósito, para um ambiente ainda não migrado não subir com o banco errado.
    DATABASE_URL: z
      .string()
      .regex(
        /^postgres(ql)?:\/\//,
        'DATABASE_URL deve ser uma URL postgresql://usuario:senha@host:5432/banco'
      ),
    CORS_ORIGINS: z.string().default(''),
    // Quantos proxies confiáveis existem na frente da API (Next rewrite, Traefik, Cloudflare...).
    // 0 = ninguém: request.ip é o IP da conexão. Errar para mais permite forjar X-Forwarded-For
    // e burlar o rate limit; errar para menos faz todo usuário parecer o IP do proxy.
    TRUST_PROXY_HOPS: z
      .string()
      .default('0')
      .transform((val) => Number.parseInt(val, 10))
      .pipe(z.number().int().min(0)),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET deve ter pelo menos 32 caracteres'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z
      .string()
      .default('30')
      .transform((val) => Number.parseInt(val, 10))
      .pipe(z.number().int().positive()),
    COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET deve ter pelo menos 32 caracteres'),
    REDIS_URL: z.string().default('redis://localhost:6381'),
    // Bucket S3-compatível (R2 em produção, MinIO em dev). Opcionais: sem elas o upload de imagem
    // responde erro claro, mas o resto da API sobe normalmente.
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().min(1).optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    // URL pública (CDN) de onde as imagens são servidas; vai em `Media.url`.
    S3_PUBLIC_BASE_URL: z.string().url().optional(),
    // IA que sugere o SKU de um item de nota de compra. Opcional: sem a chave, o botão responde erro claro
    // e o resto da API sobe normalmente.
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    AI_MODEL: z.string().default('claude-haiku-4-5-20251001'),
    // Entrar com Google (opcional): Client ID do OAuth (tipo Web). Sem ele, a API recusa o login Google.
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    // Frete real pelo Melhor Envio (Correios, Jadlog, Loggi...). Opcional: sem o token a loja usa a
    // estimativa por região (marcada como estimada na tela).
    MELHOR_ENVIO_TOKEN: z.string().min(1).optional(),
    MELHOR_ENVIO_ENV: z.enum(['sandbox', 'production']).default('production'),
    // O Melhor Envio exige um contato no User-Agent.
    MELHOR_ENVIO_CONTACT_EMAIL: z.string().email().optional(),
    // CEP de origem das encomendas (a loja em Barretos – SP).
    STORE_ZIP: z
      .string()
      .regex(/^\d{8}$/, 'STORE_ZIP deve ter 8 dígitos')
      .default('14780000'),
    // Pagamento: `mock` (simulado, padrão) ou `mercadopago`.
    PAYMENT_PROVIDER: z.enum(['mock', 'mercadopago']).default('mock'),
    // Access token da aplicação (Credenciais de produção ou de teste) e a assinatura secreta dos webhooks.
    MERCADOPAGO_ACCESS_TOKEN: z.string().min(1).optional(),
    MERCADOPAGO_WEBHOOK_SECRET: z.string().min(1).optional(),
    // URL pública da API (https), para o Mercado Pago avisar os pagamentos: <API_PUBLIC_URL>/api/webhooks/mercadopago.
    API_PUBLIC_URL: z.string().url().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.PAYMENT_PROVIDER !== 'mercadopago') return;
    for (const key of ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET'] as const) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} é obrigatório com PAYMENT_PROVIDER=mercadopago`,
        });
      }
    }
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
    const { NODE_ENV, PORT, HOST, TRUST_PROXY_HOPS } = getEnv();
    return { NODE_ENV, PORT, HOST, TRUST_PROXY_HOPS };
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
  get s3() {
    const {
      S3_ENDPOINT,
      S3_REGION,
      S3_BUCKET,
      S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY,
      S3_PUBLIC_BASE_URL,
    } = getEnv();
    return {
      ENDPOINT: S3_ENDPOINT,
      REGION: S3_REGION,
      BUCKET: S3_BUCKET,
      ACCESS_KEY_ID: S3_ACCESS_KEY_ID,
      SECRET_ACCESS_KEY: S3_SECRET_ACCESS_KEY,
      PUBLIC_BASE_URL: S3_PUBLIC_BASE_URL,
    };
  },
  get shipping() {
    const { MELHOR_ENVIO_TOKEN, MELHOR_ENVIO_ENV, MELHOR_ENVIO_CONTACT_EMAIL, STORE_ZIP } =
      getEnv();
    return {
      MELHOR_ENVIO_TOKEN,
      MELHOR_ENVIO_ENV,
      MELHOR_ENVIO_CONTACT_EMAIL,
      STORE_ZIP,
    };
  },
  get payments() {
    const {
      PAYMENT_PROVIDER,
      MERCADOPAGO_ACCESS_TOKEN,
      MERCADOPAGO_WEBHOOK_SECRET,
      API_PUBLIC_URL,
    } = getEnv();
    return {
      PROVIDER: PAYMENT_PROVIDER,
      MERCADOPAGO_ACCESS_TOKEN,
      MERCADOPAGO_WEBHOOK_SECRET,
      API_PUBLIC_URL,
    };
  },
  get google() {
    const { GOOGLE_CLIENT_ID } = getEnv();
    return { CLIENT_ID: GOOGLE_CLIENT_ID };
  },
  get ai() {
    const { ANTHROPIC_API_KEY, AI_MODEL } = getEnv();
    return { API_KEY: ANTHROPIC_API_KEY, MODEL: AI_MODEL };
  },
};
