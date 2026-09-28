import { AppError } from './app-error';

export class ExternalApiError extends AppError {
  readonly status_code = 502;
  readonly error = 'Bad Gateway';
  readonly code = 'external_api_error';

  constructor(
    message: string,
    readonly details?: unknown
  ) {
    super(message);
  }
}
