import { createInstrumentSearch } from './execute.js';
import { instrumentSearchQuerySchema } from './schema.js';

/**
 * @param {import('express').Express} app
 * @param {import('../../../shared/ports.js').InstrumentSearchReader} instrumentSearchReader
 * @returns {void}
 */
export const registerInstrumentSearchRoute = (app, instrumentSearchReader) => {
  const execute = createInstrumentSearch(instrumentSearchReader);
  app.get('/api/instruments', async (req, res, next) => {
    try {
      const { search } = instrumentSearchQuerySchema.parse(req.query);
      res.status(200).json(await execute(search));
    } catch (error) {
      next(error);
    }
  });
};
