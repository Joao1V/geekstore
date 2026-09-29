import { z } from 'zod';

import { dataResponse } from './common';

export const authLoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type AuthLoginBody = z.infer<typeof authLoginBodySchema>;

export const authUserSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authSessionSchema = z.object({
  access_token: z.string(),
  user: authUserSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const authSessionResponseSchema = dataResponse(authSessionSchema);
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
