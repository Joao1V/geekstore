import argon2 from 'argon2';

import { prisma } from '../src/index';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@geekstore.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'geekstore-dev-2026';

  const passwordHash = await argon2.hash(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, password_hash: passwordHash, name: 'Admin GeekStore' },
  });

  console.log(`Usuário admin pronto: ${user.email} (senha: ${password})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
