import { type Prisma, prisma } from '@geekstore/db';
import {
  type AdminUser,
  type AdminUserBody,
  type AdminUserUpdateBody,
  type Paginated,
  type PaginationQuery,
  type RoleCode,
  roleCodeSchema,
} from '@geekstore/shared';

import { BadRequestError, ConflictError, NotFoundError } from '../../core/_errors';
import { writeAuditLog } from '../../core/audit';
import { buildMeta, parseSort, skipTake } from '../../core/http/pagination';
import { hashPassword } from '../../core/security/password';
import { assertNotSelfRoleChange, assertOwnerRemains } from './users.rules';

const ENTITY = 'user';
const SORT_FIELDS = ['created_at', 'name', 'email'] as const;

type UserRow = {
  user_id: string;
  email: string;
  name: string;
  created_at: Date;
  role: { code: string };
};

const withRole = { include: { role: true } } satisfies Prisma.UserDefaultArgs;

function toAdminUser(row: UserRow): AdminUser {
  return {
    user_id: row.user_id,
    email: row.email,
    name: row.name,
    role: roleCodeSchema.parse(row.role.code),
    created_at: row.created_at.toISOString(),
  };
}

/** Versão do usuário que vai para a auditoria: nunca inclui o hash da senha. */
function toAuditSnapshot(row: UserRow) {
  return {
    user_id: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role.code,
  };
}

export async function listUsers(query: PaginationQuery): Promise<Paginated<AdminUser>> {
  const { field, direction } = parseSort(query.sort, SORT_FIELDS, {
    field: 'created_at',
    direction: 'asc',
  });

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ [field]: direction }, { user_id: 'asc' }],
      ...withRole,
      ...skipTake(query.page, query.page_size),
    }),
    prisma.user.count(),
  ]);
  return { data: rows.map(toAdminUser), meta: buildMeta(query.page, query.page_size, total) };
}

export async function getUser(userId: string): Promise<AdminUser> {
  const row = await prisma.user.findUnique({ where: { user_id: userId }, ...withRole });
  if (!row) throw new NotFoundError('Usuário não encontrado.');
  return toAdminUser(row);
}

async function findRoleId(tx: Prisma.TransactionClient, code: RoleCode): Promise<string> {
  const role = await tx.role.findUnique({ where: { code } });
  if (!role) throw new BadRequestError('Perfil não encontrado.');
  return role.role_id;
}

export async function createUser(actorId: string, body: AdminUserBody): Promise<AdminUser> {
  const passwordHash = await hashPassword(body.password);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email: body.email } });
    if (existing) throw new ConflictError('Já existe um usuário com esse e-mail.');

    const created = await tx.user.create({
      data: {
        email: body.email,
        name: body.name,
        password_hash: passwordHash,
        role_id: await findRoleId(tx, body.role),
      },
      ...withRole,
    });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: created.user_id,
      action: 'create',
      after: toAuditSnapshot(created),
    });
    return toAdminUser(created);
  });
}

/** Trava (`FOR UPDATE OF u`, só as linhas de usuário; `user` é palavra reservada, vai entre aspas) todos os owners: duas remoções simultâneas não zeram os donos. */
async function lockOwners(tx: Prisma.TransactionClient): Promise<string[]> {
  const rows = await tx.$queryRaw<{ user_id: string }[]>`
    SELECT u.user_id
    FROM "user" u
    JOIN role r ON r.role_id = u.role_id
    WHERE r.code = 'owner'
    FOR UPDATE OF u`;
  return rows.map((row) => row.user_id);
}

async function revokeSessions(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.refreshToken.updateMany({
    where: { user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

export async function updateUser(
  actorId: string,
  userId: string,
  body: AdminUserUpdateBody
): Promise<AdminUser> {
  const passwordHash = body.password ? await hashPassword(body.password) : undefined;

  return prisma.$transaction(async (tx) => {
    const owners = await lockOwners(tx);
    const before = await tx.user.findUnique({ where: { user_id: userId }, ...withRole });
    if (!before) throw new NotFoundError('Usuário não encontrado.');

    if (body.role !== undefined && body.role !== before.role.code) {
      assertNotSelfRoleChange(actorId, userId);
      assertOwnerRemains({ owners, targetId: userId, targetIsOwner: before.role.code === 'owner' });
    }

    const updated = await tx.user.update({
      where: { user_id: userId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(passwordHash ? { password_hash: passwordHash } : {}),
        ...(body.role !== undefined ? { role_id: await findRoleId(tx, body.role) } : {}),
      },
      ...withRole,
    });

    // Troca de perfil ou de senha encerra as sessões: o access token antigo ainda vale até
    // expirar (15 min), mas ninguém consegue renová-lo com o perfil/senha anteriores.
    if (passwordHash || updated.role.code !== before.role.code) await revokeSessions(tx, userId);

    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: userId,
      action: 'update',
      before: toAuditSnapshot(before),
      after: { ...toAuditSnapshot(updated), ...(passwordHash ? { password_changed: true } : {}) },
    });
    return toAdminUser(updated);
  });
}

export async function deleteUser(actorId: string, userId: string): Promise<void> {
  if (actorId === userId) throw new BadRequestError('Você não pode excluir a própria conta.');

  await prisma.$transaction(async (tx) => {
    const owners = await lockOwners(tx);
    const before = await tx.user.findUnique({ where: { user_id: userId }, ...withRole });
    if (!before) throw new NotFoundError('Usuário não encontrado.');

    assertOwnerRemains({ owners, targetId: userId, targetIsOwner: before.role.code === 'owner' });

    await tx.user.delete({ where: { user_id: userId } });
    await writeAuditLog(tx, {
      userId: actorId,
      entity: ENTITY,
      entityId: userId,
      action: 'delete',
      before: toAuditSnapshot(before),
    });
  });
}
