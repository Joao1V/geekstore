import { BadRequestError, ConflictError } from '../../core/_errors';

/** O usuário não altera o próprio perfil de acesso (evita se rebaixar ou se promover por engano). */
export function assertNotSelfRoleChange(actorId: string, targetId: string): void {
  if (actorId === targetId) {
    throw new BadRequestError('Você não pode alterar o seu próprio perfil de acesso.');
  }
}

/**
 * Rebaixar ou excluir um owner só é permitido se sobrar outro. `owners` são os ids dos owners
 * atuais (lidos com trava dentro da transação).
 */
export function assertOwnerRemains(input: {
  owners: readonly string[];
  targetId: string;
  targetIsOwner: boolean;
}): void {
  if (!input.targetIsOwner) return;
  const remaining = input.owners.filter((id) => id !== input.targetId);
  if (remaining.length === 0) {
    throw new ConflictError('Não é possível remover o último usuário com perfil owner.');
  }
}
