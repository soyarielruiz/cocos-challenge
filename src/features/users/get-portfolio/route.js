import { createGetPortfolio } from './execute.js';
import { portfolioParamsSchema } from './schema.js';

/**
 * @param {import('express').Express} app
 * @param {import('../../../shared/ports.js').PortfolioReader} portfolioReader
 * @param {import('../../../shared/ports.js').LatestMarketDataReader} marketDataReader
 * @returns {void}
 */
export const registerGetPortfolioRoute = (app, portfolioReader, marketDataReader) => {
  const execute = createGetPortfolio({ portfolioReader, marketDataReader });
  app.get('/api/users/:userId/portfolio', async (req, res, next) => {
    try {
      const { userId } = portfolioParamsSchema.parse(req.params);
      res.status(200).json(await execute(userId));
    } catch (error) {
      next(error);
    }
  });
};
