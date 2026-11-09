import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { AssignmentState, ErrorCode } from '@staffing/shared';
import type { Logger } from 'pino';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  SHIFT_FULL: 409,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
  INTERNAL: 500,
};

type Details = { current?: AssignmentState; filled?: number; required?: number };

/** An expected, user-facing error. Anything else becomes a 500 INTERNAL. */
export class DomainError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: Details = {},
  ) {
    super(message);
    this.name = 'DomainError';
    this.status = STATUS[code];
  }
}

export function sendError(
  res: Parameters<RequestHandler>[1],
  error: DomainError,
): void {
  res.status(error.status).json({
    error: { code: error.code, message: error.message, ...error.details },
    requestId: String(res.locals.requestId ?? ''),
  });
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new DomainError('NOT_FOUND', 'This endpoint does not exist.'));
};

/** Maps errors to the single error format. Never sends a stack trace. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    if (err instanceof DomainError) return sendError(res, err);

    // Body parser errors (invalid JSON, body too large).
    const status = typeof err?.status === 'number' ? err.status : undefined;
    if (status && status >= 400 && status < 500) {
      return sendError(res, new DomainError('VALIDATION_ERROR', 'The request body is not valid.'));
    }

    logger.error({ err, requestId: res.locals.requestId }, 'unhandled error');
    sendError(res, new DomainError('INTERNAL', 'Something went wrong on our side. Nothing was saved.'));
  };
}
