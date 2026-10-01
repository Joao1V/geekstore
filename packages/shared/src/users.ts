import { z } from 'zod';

import {
  dataResponse,
  isoDateTimeSchema,
  paginatedResponse,
  paginationQuerySchema,
} from './common';
import { roleCodeSchema } from './rbac';

export const adminUserSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: roleCodeSchema,
  created_at: isoDateTimeSchema,
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserBodySchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255),
  password: z.string().min(8).max(128),
  role: roleCodeSchema,
});
export type AdminUserBody = z.infer<typeof adminUserBodySchema>;

export const adminUserUpdateBodySchema = adminUserBodySchema.omit({ email: true }).partial();
export type AdminUserUpdateBody = z.infer<typeof adminUserUpdateBodySchema>;

export const adminUserParamsSchema = z.object({ user_id: z.string().uuid() });
export const adminUserListQuerySchema = paginationQuerySchema;
export const adminUserListResponseSchema = paginatedResponse(adminUserSchema);
export const adminUserResponseSchema = dataResponse(adminUserSchema);
