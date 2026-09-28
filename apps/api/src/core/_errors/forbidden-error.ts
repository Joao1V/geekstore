import { AppError } from './app-error';

export class ForbiddenError extends AppError {
  readonly status_code = 403;
  readonly error = 'Forbidden';
  readonly code = 'forbidden';
}
