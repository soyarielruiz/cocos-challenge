import { createHealthCheck } from './execute.js';

/**
 * @param {import('express').Express} app
 * @param {import('../../../shared/ports.js').DatabaseHealthReader} healthReader
 * @returns {void}
 */
export const registerHealthRoute = (app, healthReader) => {
  const execute = createHealthCheck(healthReader);
  app.get('/health', async (_req, res, next) => {
    try {
      res.status(200).json(await execute());
    } catch (error) {
      next(error);
    }
  });
};
