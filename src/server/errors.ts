export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/** 400 error for malformed requests. */
export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, 'BAD_REQUEST', message, details);
}

/** 401 error when no valid session exists. */
export function unauthorized(message = 'É preciso entrar para continuar.'): AppError {
  return new AppError(401, 'UNAUTHORIZED', message);
}

/** 403 error when the user lacks permission. */
export function forbidden(message = 'Você não tem permissão para isso.', code = 'FORBIDDEN'): AppError {
  return new AppError(403, code, message);
}

/** 404 error for a missing resource. */
export function notFound(message = 'Não encontrado.'): AppError {
  return new AppError(404, 'NOT_FOUND', message);
}

/** 409 error for conflicts such as a newer saved version. */
export function conflict(code: string, message: string, details?: unknown): AppError {
  return new AppError(409, code, message, details);
}

/** 422 error for documents that fail validation. */
export function unprocessable(message: string, details?: unknown): AppError {
  return new AppError(422, 'VALIDATION_FAILED', message, details);
}

/** 429 error when the login rate limit is reached. */
export function tooManyRequests(message: string): AppError {
  return new AppError(429, 'TOO_MANY_ATTEMPTS', message);
}
