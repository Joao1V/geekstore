import { z } from 'zod';

export const permissions = [
  'catalog:read',
  'catalog:write',
  'stock:read',
  'stock:write',
  'pricing:read',
  'pricing:write',
  'audit:read',
  'users:read',
  'users:write',
  'queues:read',
] as const;
export const permissionSchema = z.enum(permissions);
export type Permission = z.infer<typeof permissionSchema>;

export const roleCodes = ['owner', 'manager', 'stock', 'support', 'viewer'] as const;
export const roleCodeSchema = z.enum(roleCodes);
export type RoleCode = z.infer<typeof roleCodeSchema>;

const readOnly: Permission[] = ['catalog:read', 'stock:read', 'pricing:read'];

/** Perfil -> permissões (RF-PLA-03). A tabela `role` guarda só a identidade; o mapa vive aqui. */
export const rolePermissions: Record<RoleCode, readonly Permission[]> = {
  owner: permissions,
  manager: [
    'catalog:read',
    'catalog:write',
    'stock:read',
    'stock:write',
    'pricing:read',
    'pricing:write',
    'audit:read',
    'users:read',
    'queues:read',
  ],
  stock: ['catalog:read', 'stock:read', 'stock:write', 'pricing:read'],
  support: readOnly,
  viewer: readOnly,
};

export function hasPermission(role: RoleCode, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
