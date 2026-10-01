import argon2 from 'argon2';

import { prisma } from '../src/index';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const DEV_PASSWORD = 'geekstore-dev-2026';
const MIN_PASSWORD_LENGTH = 12;

/**
 * A senha padrão está no repositório, então só vale em banco local. Em qualquer outro banco
 * (staging, produção) o seed exige `SEED_ADMIN_PASSWORD` e nunca a imprime nos logs.
 */
function resolveAdminPassword(): { password: string; isDefault: boolean } {
  const provided = process.env.SEED_ADMIN_PASSWORD;
  if (provided) {
    if (provided.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `SEED_ADMIN_PASSWORD precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`
      );
    }
    return { password: provided, isDefault: false };
  }
  const host = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost').hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      'Defina SEED_ADMIN_PASSWORD: a senha padrão de desenvolvimento só é aceita em banco local.'
    );
  }
  return { password: DEV_PASSWORD, isDefault: true };
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@geekstore.local';
  const { password, isDefault } = resolveAdminPassword();
  const owner = await prisma.role.findUniqueOrThrow({ where: { code: 'owner' } });

  // `update` não mexe na senha: rodar o seed de novo nunca redefine a de um admin existente.
  const user = await prisma.user.upsert({
    where: { email },
    update: { role_id: owner.role_id },
    create: {
      email,
      password_hash: await argon2.hash(password),
      name: 'Admin GeekStore',
      role_id: owner.role_id,
    },
  });
  console.log(
    isDefault
      ? `Usuário admin pronto: ${user.email} (senha de desenvolvimento: ${DEV_PASSWORD})`
      : `Usuário admin pronto: ${user.email}`
  );
}

async function main() {
  await seedAdmin();
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
