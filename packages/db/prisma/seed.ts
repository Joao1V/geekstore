import argon2 from 'argon2';

import { prisma } from '../src/index';

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@geekstore.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'geekstore-dev-2026';
  const owner = await prisma.role.findUniqueOrThrow({ where: { code: 'owner' } });

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
  console.log(`Usuário admin pronto: ${user.email} (senha: ${password})`);
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
