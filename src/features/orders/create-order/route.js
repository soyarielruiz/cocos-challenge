import { createOrder } from './execute.js';
import { orderRequestSchema } from './schema.js';

/**
 * @param {import('express').Express} app
 * @param {import('../../../shared/ports.js').OrderRepository} orderRepository
 * @param {import('../../../shared/ports.js').TransactionManager} transactionManager
 * @param {import('../../../shared/ports.js').LatestMarketDataReader} marketDataReader
 * @returns {void}
 */
export const registerCreateOrderRoute = (
  app,
  orderRepository,
  transactionManager,
  marketDataReader,
) => {
  const execute = createOrder({ orderRepository, transactionManager, marketDataReader });
  app.post('/api/orders', async (req, res, next) => {
    try {
      const order = orderRequestSchema.parse(req.body);
      res.status(201).json(await execute(order));
    } catch (error) {
      next(error);
    }
  });
};
