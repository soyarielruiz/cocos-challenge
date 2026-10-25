import { describe, expect, test } from '@jest/globals';
import { NotFoundError, OrderNotCancellableError } from '../../../shared/errors.js';
import { cancelOrder } from './execute.js';

const order = {
  id: 12,
  userId: 7,
  instrumentId: 3,
  size: 2,
  price: '10',
  type: 'LIMIT',
  side: 'BUY',
  status: 'NEW',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const build = ({ foundOrder = order, cancelledOrder = { ...order, status: 'CANCELLED' } } = {}) => {
  const calls = [];
  const orderRepository = {
    findOwnedOrder: async (orderId, userId, options) => {
      calls.push(['findOwnedOrder', orderId, userId, options]);
      return foundOrder;
    },
    cancelIfNew: async (orderId, userId, options) => {
      calls.push(['cancelIfNew', orderId, userId, options]);
      return cancelledOrder;
    },
  };
  const transactionManager = {
    withUserLock: async (userId, operation) => {
      calls.push(['withUserLock', userId]);
      return operation({ transaction: true });
    },
  };

  return { execute: cancelOrder({ orderRepository, transactionManager }), calls };
};

describe('cancel order use case', () => {
  test('cancels an owned NEW order under the requesting user lock', async () => {
    const { execute, calls } = build();

    await expect(execute({ id: 12, userId: 7 })).resolves.toMatchObject({
      id: 12,
      userId: 7,
      status: 'CANCELLED',
    });
    expect(calls).toEqual([
      ['withUserLock', 7],
      ['findOwnedOrder', 12, 7, { tx: { transaction: true } }],
      ['cancelIfNew', 12, 7, { tx: { transaction: true } }],
    ]);
  });

  test('returns NOT_FOUND when the order is missing or belongs to another user', async () => {
    const { execute } = build({ foundOrder: null });

    await expect(execute({ id: 12, userId: 7 })).rejects.toBeInstanceOf(NotFoundError);
  });

  test.each(['FILLED', 'REJECTED', 'CANCELLED'])(
    'returns ORDER_NOT_CANCELLABLE for a %s order',
    async (status) => {
      const { execute, calls } = build({ foundOrder: { ...order, status } });

      await expect(execute({ id: 12, userId: 7 }))
        .rejects.toBeInstanceOf(OrderNotCancellableError);
      expect(calls.some(([name]) => name === 'cancelIfNew')).toBe(false);
    },
  );

  test('returns ORDER_NOT_CANCELLABLE if the conditional state change loses a race', async () => {
    const { execute } = build({ cancelledOrder: null });

    await expect(execute({ id: 12, userId: 7 }))
      .rejects.toBeInstanceOf(OrderNotCancellableError);
  });
});
