import { NotFoundError, OrderNotCancellableError } from '../../../shared/errors.js';
import { assertCancelable } from '../../../shared/policies/assert-cancelable.js';

/**
 * @typedef {import('../../../shared/ports.js').OrderRepository} OrderRepository
 * @typedef {import('../../../shared/ports.js').TransactionManager} TransactionManager
 * @typedef {import('../create-order/schema.js').OrderResponse} OrderResponse
 * @typedef {import('./schema.js').CancelOrderRequest} CancelOrderRequest
 */

/**
 * @param {object} dependencies
 * @param {OrderRepository} dependencies.orderRepository
 * @param {TransactionManager} dependencies.transactionManager
 * @returns {(request: CancelOrderRequest) => Promise<OrderResponse>}
 */
export const cancelOrder = ({ orderRepository, transactionManager }) => async ({ id, userId }) => (
  transactionManager.withUserLock(userId, async (tx) => {
    const existing = await orderRepository.findOwnedOrder(id, userId, { tx });
    if (!existing) {
      throw new NotFoundError('Order not found');
    }

    assertCancelable(existing.status);

    const cancelled = await orderRepository.cancelIfNew(id, userId, { tx });
    if (!cancelled) {
      throw new OrderNotCancellableError();
    }

    return {
      id: cancelled.id,
      userId: cancelled.userId,
      instrumentId: cancelled.instrumentId,
      size: cancelled.size,
      price: Number(cancelled.price),
      type: cancelled.type,
      side: cancelled.side,
      status: cancelled.status,
      createdAt: cancelled.createdAt.toISOString(),
    };
  })
);
