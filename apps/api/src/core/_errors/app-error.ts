import type { ApiErrorCode } from '@geekstore/shared';

export abstract class AppError extends Error {
  abstract readonly status_code: number;
  abstract readonly error: string;
  abstract readonly code: ApiErrorCode;
}
