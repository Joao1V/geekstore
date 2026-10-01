import type { Prisma } from '@geekstore/db';
import type { AuditLog } from '@geekstore/shared';

export type AuditTx = Pick<Prisma.TransactionClient, 'auditLog'>;

export type AuditEntry = {
  userId: string | null;
  entity: string;
  entityId: string;
  action: AuditLog['action'];
  before?: unknown;
  after?: unknown;
};

/** Converte para JSON puro (Date vira string ISO) e evita gravar `undefined`/`null` como valor. */
export function toAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Grava o log de auditoria (RF-PLA-04). Sempre recebe o cliente da MESMA transação da mudança:
 * se a transação der rollback, o log some junto (não existe log órfão nem mudança sem log).
 */
export async function writeAuditLog(tx: AuditTx, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      user_id: entry.userId,
      entity: entry.entity,
      entity_id: entry.entityId,
      action: entry.action,
      before: toAuditJson(entry.before),
      after: toAuditJson(entry.after),
    },
  });
}

export type AuditBatchTx = Pick<Prisma.TransactionClient, 'auditLog'>;

/** Versão em lote de `writeAuditLog` (uma inserção só), para operações de até centenas de linhas. */
export async function writeAuditLogs(
  tx: AuditBatchTx,
  entries: readonly AuditEntry[]
): Promise<void> {
  if (entries.length === 0) return;
  await tx.auditLog.createMany({
    data: entries.map((entry) => ({
      user_id: entry.userId,
      entity: entry.entity,
      entity_id: entry.entityId,
      action: entry.action,
      before: toAuditJson(entry.before),
      after: toAuditJson(entry.after),
    })),
  });
}
