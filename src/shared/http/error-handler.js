import { ZodError } from 'zod';
import { AppError, InvalidRequestError, NotFoundError, ResourceConflictError } from '../errors.js';

const CONFLICT_SQLSTATES = new Set(['23505', '23503']);
const CONFLICT_PRISMA_CODES = new Set(['P2002', 'P2003']);

/**
 * @param {Error} error
 * @returns {AppError | undefined}
 */
const translatePersistenceError = (error) => {
  const { code, meta } = /** @type {{ code?: unknown, meta?: { code?: unknown } }} */ (error);
  if (typeof code !== 'string') {
    return undefined;
  }
  if (code === 'P2025') {
    return new NotFoundError();
  }
  if (CONFLICT_PRISMA_CODES.has(code) || CONFLICT_SQLSTATES.has(code)) {
    return new ResourceConflictError();
  }
  if (code === 'P2010' && typeof meta?.code === 'string' && CONFLICT_SQLSTATES.has(meta.code)) {
    return new ResourceConflictError();
  }
  return undefined;
};

/**
 * @param {unknown} error
 * @returns {{ appError: AppError, expected: boolean }} `expected` errors are client faults needing no server log
 */
const toAppError = (error) => {
  if (error instanceof AppError) {
    return { appError: error, expected: true };
  }
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`);
    return { appError: new InvalidRequestError(details), expected: true };
  }
  if (error instanceof Error) {
    if (/** @type {{ type?: unknown }} */ (error).type === 'entity.parse.failed') {
      return { appError: new InvalidRequestError(undefined, 'Malformed JSON body'), expected: true };
    }
    const translated = translatePersistenceError(error);
    if (translated) {
      return { appError: translated, expected: false };
    }
  }
  return { appError: new AppError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error'), expected: false };
};

/**
 * Forwards a NOT_FOUND error for routes that no handler matched.
 * @returns {import('express').RequestHandler}
 */
export const notFoundHandler = () => (_req, _res, next) => next(new NotFoundError());

/**
 * Single error boundary: maps errors to `{ code, message, details? }` and never leaks internals.
 * @param {import('pino').Logger} logger
 * @returns {import('express').ErrorRequestHandler}
 */
export const errorHandler = (logger) => (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const { appError, expected } = toAppError(error);
  if (!expected) {
    (res.locals.logger ?? logger).error({ err: error }, 'request failed');
  }
  const body = { code: appError.code, message: appError.message };
  if (appError.details) {
    body.details = appError.details;
  }
  res.status(appError.status).json(body);
};
