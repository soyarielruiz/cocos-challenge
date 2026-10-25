import { describe, expect, test } from '@jest/globals';
import Decimal from 'decimal.js';
import { createLimitExecutor } from './limit-executor.js';

const instrument = {
  id: 3,
  ticker: 'ABC',
  name: 'Example S.A.',
  type: 'ACCIONES',
};

const build = () => {
  const created = [];
  const orderRepository = {
    getFilledOrders: async () => {
      throw new Error('LIMIT orders must not check cash or positions.');
    },
    create: async (data, options) => {
      created.push({ data, options });
      return {
        id: created.length,
        ...data,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      };
    },
  };

  return { executor: createLimitExecutor({ orderRepository }), created };
};

const execution = (request) => ({
  request,
  instrument,
  tx: { transaction: true },
});

describe('LIMIT order executor', () => {
  test('persists valid orders as NEW at the requested price without checking balances', async () => {
    const { executor, created } = build();

    const order = await executor.execute(execution({
      userId: 1,
      instrumentId: instrument.id,
      side: 'BUY',
      type: 'LIMIT',
      size: 10,
      price: 12.5,
    }));

    expect(order).toMatchObject({
      size: 10,
      price: 12.5,
      type: 'LIMIT',
      status: 'NEW',
    });
    expect(created[0]).toMatchObject({
      data: {
        size: 10,
        price: new Decimal('12.5'),
        status: 'NEW',
      },
      options: { tx: { transaction: true } },
    });
  });

  test('floors amount using the requested limit price and persists zero size as REJECTED', async () => {
    const { executor, created } = build();

    const order = await executor.execute(execution({
      userId: 1,
      instrumentId: instrument.id,
      side: 'BUY',
      type: 'LIMIT',
      amount: 1,
      price: 0.3,
    }));

    expect(order).toMatchObject({ size: 3, price: 0.3, status: 'NEW' });

    const zero = await executor.execute(execution({
      userId: 1,
      instrumentId: instrument.id,
      side: 'BUY',
      type: 'LIMIT',
      amount: 0.29,
      price: 0.3,
    }));

    expect(zero).toMatchObject({ size: 0, price: 0.3, status: 'REJECTED' });
    expect(created.map(({ data }) => data.status)).toEqual(['NEW', 'REJECTED']);
  });
});
