import { AppError } from './app-error';

export class BadRequestError extends AppError {
  readonly status_code = 400;
  readonly error = 'Bad Request';
  readonly code = 'bad_request';
}
