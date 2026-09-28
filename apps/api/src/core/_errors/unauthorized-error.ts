import { AppError } from './app-error';

export class UnauthorizedError extends AppError {
  readonly status_code = 401;
  readonly error = 'Unauthorized';
  readonly code = 'unauthorized';
}
