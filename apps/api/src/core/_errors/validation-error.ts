import { AppError } from './app-error';

export class ValidationError extends AppError {
  readonly status_code = 400;
  readonly error = 'Bad Request';
  readonly code = 'validation_failed';

  constructor(
    message: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}
