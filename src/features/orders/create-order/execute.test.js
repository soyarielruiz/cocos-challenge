import { describe, expect, test } from '@jest/globals';
import { InvalidRequestError, NotFoundError } from '../../../shared/errors.js';
import { createOrder } from './execute.js';

const instrument = {
  id: 3,
  ticker: 'ABC',
  name: 'Example S.A.',
  type: 'ACCIONES',
};

const ars = {
  id: 66,
  ticker: 'ARS',
  name: 'Peso Argentino',
  type: 'MONEDA',
};

const build = ({ filledOrders = [], selectedInstrument = instrument, price = '10' } = {}) => {
  const created = [];
  const calls = [];
  const orderRepository = {
    findUser: async (userId, options) => {
      calls.push(['findUser', userId, options]);
      return userId === 1 ? { id: 1 } : null;
    },
    findInstrument: async (instrumentId, options) => {
      calls.push(['findInstrument', instrumentId, options]);
      return instrumentId === selectedInstrument.id ? selectedInstrument : null;
    },
    getFilledOrders: async (userId, options) => {
      calls.push(['getFilledOrders', userId, options]);
      return filledOrders;
    },
    create: async (data, options) => {
      calls.push(['create', data, options]);
      const order = { id: created.length + 1, ...data, createdAt: new Date('2026-01-01T00:00:00Z') };
      created.push(order);
      return order;
    },
  };
  const transactionManager = {
    withUserLock: async (userId, operation) => {
      calls.push(['withUserLock', userId]);
      return operation({ transaction: true });
    },
  };
  const marketDataReader = {
    getLatestPrices: async (instrumentIds, options) => {
      calls.push(['getLatestPrices', instrumentIds, options]);
      return instrumentIds.map((instrumentId) => ({
        instrumentId,
        close: price,
        previousClose: '9',
      }));
    },
  };
  return {
    execute: createOrder({ orderRepository, transactionManager, marketDataReader }),
    created,
    calls,
  };
};

const marketRequest = (overrides = {}) => ({
  userId: 1,
  instrumentId: instrument.id,
  side: 'BUY',
  type: 'MARKET',
  size: 2,
  ...overrides,
});

describe('create order use case', () => {
  test('fills a MARKET BUY when derived cash is sufficient, under a user-locked transaction', async () => {
    const { execute, created, calls } = build({
      filledOrders: [
        { side: 'CASH_IN', size: 100, price: '1', instrument: ars },
      ],
    });

    const result = await execute(marketRequest());

    expect(result.status).toBe('FILLED');
    expect(result.price).toBe(10);
    expect(created).toHaveLength(1);
    expect(calls[0]).toEqual(['withUserLock', 1]);
    expect(calls.at(-1)[2]).toEqual({ tx: { transaction: true } });
  });

  test('persists a LIMIT order as NEW without reading market data or balances', async () => {
    const { execute, created, calls } = build();

    const result = await execute(marketRequest({
      type: 'LIMIT',
      size: 2,
      price: 8,
    }));

    expect(result).toMatchObject({ type: 'LIMIT', size: 2, price: 8, status: 'NEW' });
    expect(created[0]).toMatchObject({ type: 'LIMIT', size: 2, status: 'NEW' });
    expect(created[0].price.toString()).toBe('8');
    expect(calls.some(([name]) => name === 'getFilledOrders')).toBe(false);
    expect(calls.some(([name]) => name === 'getLatestPrices')).toBe(false);
  });

  test('persists an insufficient-cash BUY as REJECTED', async () => {
    const { execute, created } = build({
      filledOrders: [
        { side: 'CASH_IN', size: 19, price: '1', instrument: ars },
      ],
    });

    const result = await execute(marketRequest());

    expect(result.status).toBe('REJECTED');
    expect(created[0]).toMatchObject({ size: 2, status: 'REJECTED' });
    expect(created[0].price.toString()).toBe('10');
  });

  test('fills a MARKET SELL when derived positions are sufficient', async () => {
    const { execute, created } = build({
      filledOrders: [
        { side: 'BUY', size: 5, price: '10', instrument },
        { side: 'SELL', size: 2, price: '9', instrument },
      ],
    });

    const order = await execute(marketRequest({ side: 'SELL', size: 3 }));

    expect(order).toMatchObject({ side: 'SELL', size: 3, price: 10, status: 'FILLED' });
    expect(created[0]).toMatchObject({ side: 'SELL', size: 3, status: 'FILLED' });
  });

  test('persists a MARKET SELL as REJECTED when derived positions are insufficient', async () => {
    const { execute, created } = build({
      filledOrders: [
        { side: 'BUY', size: 5, price: '10', instrument },
        { side: 'SELL', size: 3, price: '9', instrument },
      ],
    });

    const order = await execute(marketRequest({ side: 'SELL', size: 3 }));

    expect(order).toMatchObject({ side: 'SELL', size: 3, status: 'REJECTED' });
    expect(created[0]).toMatchObject({ side: 'SELL', size: 3, status: 'REJECTED' });
  });

  test('floors amount with decimal-safe arithmetic and persists a zero-size result as REJECTED', async () => {
    const { execute, created } = build({
      filledOrders: [
        { side: 'CASH_IN', size: 100, price: '1', instrument: ars },
      ],
      price: '0.30',
    });

    const order = await execute(marketRequest({ size: undefined, amount: 1 }));

    expect(order).toMatchObject({ size: 3, status: 'FILLED' });
    expect(created[0].price.toString()).toBe('0.3');

    const zeroSize = await execute(marketRequest({ size: undefined, amount: 0.29 }));
    expect(zeroSize).toMatchObject({ size: 0, status: 'REJECTED' });
  });

  test('fills CASH_IN as integer ARS units without market data', async () => {
    const { execute, created, calls } = build({ selectedInstrument: ars });

    const order = await execute(marketRequest({
      instrumentId: ars.id,
      side: 'CASH_IN',
      size: 2500,
    }));

    expect(order).toMatchObject({ instrumentId: ars.id, size: 2500, price: 1, status: 'FILLED' });
    expect(calls.some(([name]) => name === 'getLatestPrices')).toBe(false);
    expect(created).toHaveLength(1);
  });

  test('fills CASH_OUT only when derived available cash covers it', async () => {
    const { execute } = build({
      selectedInstrument: ars,
      filledOrders: [
        { side: 'CASH_IN', size: 1000, price: '1', instrument: ars },
      ],
    });

    const order = await execute(marketRequest({
      instrumentId: ars.id,
      side: 'CASH_OUT',
      size: 1000,
    }));
    const rejected = await execute(marketRequest({
      instrumentId: ars.id,
      side: 'CASH_OUT',
      size: 1001,
    }));

    expect(order.status).toBe('FILLED');
    expect(rejected.status).toBe('REJECTED');
  });

  test.each([
    ['missing user', () => build().execute(marketRequest({ userId: 999 }))],
    ['missing instrument', () => build().execute(marketRequest({ instrumentId: 999 }))],
  ])('returns NOT_FOUND for a %s before creating an order', async (_label, run) => {
    await expect(run()).rejects.toBeInstanceOf(NotFoundError);
  });

  test.each([
    ['cash operation on a security', { side: 'CASH_IN' }],
    ['BUY targeting MONEDA', { side: 'BUY', instrumentId: ars.id }],
  ])('rejects %s when it is a contract error', async (_label, overrides) => {
    const { execute, created } = build({ selectedInstrument: overrides.instrumentId === ars.id ? ars : instrument });

    await expect(execute(marketRequest(overrides))).rejects.toBeInstanceOf(InvalidRequestError);
    expect(created).toHaveLength(0);
  });

  test('rejects a CASH_OUT targeting a security instrument', async () => {
    const { execute, created } = build();

    await expect(execute(marketRequest({ side: 'CASH_OUT' })))
      .rejects.toBeInstanceOf(InvalidRequestError);
    expect(created).toHaveLength(0);
  });

  test('nets prior FILLED security BUYs into available cash (ADR-0014)', async () => {
    const { execute, created } = build({
      filledOrders: [
        { side: 'CASH_IN', size: 100, price: '1', instrument: ars },
        { side: 'BUY', size: 9, price: '10', instrument },
      ],
    });

    const order = await execute(marketRequest());

    expect(order.status).toBe('REJECTED');
    expect(created[0]).toMatchObject({ size: 2, status: 'REJECTED' });
  });
});
