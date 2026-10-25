import Decimal from 'decimal.js';
import { InvalidRequestError } from '../../../shared/errors.js';
import { orderResponseSchema } from './schema.js';

/**
 * @typedef {import('../../../shared/ports.js').OrderRepository} OrderRepository
 * @typedef {import('../../../shared/ports.js').OrderExecutor} OrderExecutor
 * @typedef {import('../../../shared/ports.js').OrderExecutionContext} OrderExecutionContext
 */

/**
 * @param {object} dependencies
 * @param {OrderRepository} dependencies.orderRepository
 * @returns {OrderExecutor}
 */
export const createLimitExecutor = ({ orderRepository }) => ({
  /**
   * @param {OrderExecutionContext} context
   * @returns {Promise<import('./schema.js').OrderResponse>}
   */
  execute: async ({ request, instrument, tx }) => {
    if (request.price === undefined) {
      throw new InvalidRequestError(['price: is required for LIMIT orders']);
    }

    const price = new Decimal(request.price);
    const size = request.amount === undefined
      ? request.size
      : new Decimal(request.amount).div(price).floor().toNumber();
    if (size === undefined) {
      throw new InvalidRequestError(['size: provide exactly one of size or amount']);
    }

    const created = await orderRepository.create({
      userId: request.userId,
      instrumentId: instrument.id,
      size,
      price,
      type: request.type,
      side: request.side,
      status: size === 0 ? 'REJECTED' : 'NEW',
    }, { tx });

    return orderResponseSchema.parse({
      id: created.id,
      userId: created.userId,
      instrumentId: created.instrumentId,
      size: created.size,
      price: new Decimal(created.price).toNumber(),
      type: created.type,
      side: created.side,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    });
  },
});
