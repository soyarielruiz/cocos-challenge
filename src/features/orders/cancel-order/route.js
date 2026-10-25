import { cancelOrder } from './execute.js';
import { cancelOrderParamsSchema, cancelOrderRequestSchema } from './schema.js';

/**
 * @param {import('express').Express} app
 * @param {import('../../../shared/ports.js').OrderRepository} orderRepository
 * @param {import('../../../shared/ports.js').TransactionManager} transactionManager
 * @returns {void}
 */
export const registerCancelOrderRoute = (app, orderRepository, transactionManager) => {
  const execute = cancelOrder({ orderRepository, transactionManager });

  app.post('/api/orders/:id/cancel', async (req, res, next) => {
    try {
      const { id } = cancelOrderParamsSchema.parse(req.params);
      const { userId } = cancelOrderRequestSchema.parse(req.body);
      res.status(200).json(await execute({ id, userId }));
    } catch (error) {
      next(error);
    }
  });
};
