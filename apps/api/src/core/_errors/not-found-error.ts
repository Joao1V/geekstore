import { AppError } from './app-error';

export class NotFoundError extends AppError {
  readonly status_code = 404;
  readonly error = 'Not Found';
  readonly code = 'not_found';
}
