import { z } from 'zod';

export const authLoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type AuthLoginBody = z.infer<typeof authLoginBodySchema>;

export const authUserSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authSessionResponseSchema = z.object({
  accessToken: z.string(),
  user: authUserSchema,
});
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
