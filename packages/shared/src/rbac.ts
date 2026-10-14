import { z } from 'zod';

export const permissions = [
  'catalog:read',
  'catalog:write',
  'stock:read',
  'stock:write',
  'pricing:read',
  'pricing:write',
  'orders:read',
  'orders:write',
  'content:read',
  'content:write',
  'audit:read',
  'users:read',
  'users:write',
  'queues:read',
  'queues:write',
] as const;
export const permissionSchema = z.enum(permissions);
export type Permission = z.infer<typeof permissionSchema>;

export const roleCodes = ['owner', 'manager', 'stock', 'support', 'viewer'] as const;
export const roleCodeSchema = z.enum(roleCodes);
export type RoleCode = z.infer<typeof roleCodeSchema>;

const readOnly: Permission[] = [
  'catalog:read',
  'stock:read',
  'pricing:read',
  'orders:read',
  'content:read',
];

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
    'orders:read',
    'orders:write',
    'content:read',
    'content:write',
    'audit:read',
    'users:read',
    'queues:read',
    'queues:write',
  ],
  stock: [
    'catalog:read',
    'stock:read',
    'stock:write',
    'pricing:read',
    'orders:read',
    'orders:write',
  ],
  support: readOnly,
  viewer: readOnly,
};

export function hasPermission(role: RoleCode, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
