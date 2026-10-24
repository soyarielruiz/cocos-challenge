import { randomUUID } from 'node:crypto';

/**
 * Assigns a fresh request ID, exposes it as `X-Request-Id` and binds a child logger.
 * @param {import('pino').Logger} logger
 * @returns {import('express').RequestHandler}
 */
export const requestId = (logger) => (req, res, next) => {
  const id = randomUUID();
  res.locals.logger = logger.child({ reqId: id });
  res.setHeader('X-Request-Id', id);
  next();
};
