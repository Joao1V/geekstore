import { AppError } from './app-error';

export class ConflictError extends AppError {
  readonly status_code = 409;
  readonly error = 'Conflict';
  readonly code = 'conflict';
}
