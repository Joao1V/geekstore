import { z } from 'zod';

import { dataResponse } from './common';
import { permissionSchema, roleCodeSchema } from './rbac';

export const authLoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type AuthLoginBody = z.infer<typeof authLoginBodySchema>;

/** ID token (JWT) que o botão "Entrar com Google" entrega ao navegador. Vale para o painel e para a loja. */
export const googleLoginBodySchema = z.object({
  credential: z.string().min(20).max(4096),
});
export type GoogleLoginBody = z.infer<typeof googleLoginBodySchema>;

export const authUserSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: roleCodeSchema,
  permissions: z.array(permissionSchema),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authSessionSchema = z.object({
  access_token: z.string(),
  user: authUserSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const authSessionResponseSchema = dataResponse(authSessionSchema);
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
