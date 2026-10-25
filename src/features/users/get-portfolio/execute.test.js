import { describe, expect, test } from '@jest/globals';
import { NotFoundError } from '../../../shared/errors.js';
import { createGetPortfolio } from './execute.js';

const orders = [
  {
    instrument: { id: 66, ticker: 'ARS', name: 'Peso Argentino', type: 'MONEDA' },
    side: 'CASH_IN',
    size: 1000,
    price: '1',
  },
  {
    instrument: { id: 66, ticker: 'ARS', name: 'Peso Argentino', type: 'MONEDA' },
    side: 'CASH_OUT',
    size: 200,
    price: '1',
  },
  {
    instrument: { id: 47, ticker: 'ABC', name: 'Example S.A.', type: 'ACCIONES' },
    side: 'BUY',
    size: 10,
    price: '100',
  },
  {
    instrument: { id: 47, ticker: 'ABC', name: 'Example S.A.', type: 'ACCIONES' },
    side: 'BUY',
    size: 10,
    price: '200',
  },
  {
    instrument: { id: 47, ticker: 'ABC', name: 'Example S.A.', type: 'ACCIONES' },
    side: 'SELL',
    size: 10,
    price: '150',
  },
];

describe('get portfolio use case', () => {
  test('derives cash net of filled asset trades and portfolio values from filled orders', async () => {
    const execute = createGetPortfolio({
      portfolioReader: {
        findUser: async () => ({ id: 7 }),
        getFilledOrders: async () => orders,
      },
      marketDataReader: {
        getLatestPrices: async (instrumentIds) => {
          expect(instrumentIds).toEqual([47]);
          return [{ instrumentId: 47, close: '180', previousClose: '170' }];
        },
      },
    });

    const result = await execute(7);

    expect(result.userId).toBe(7);
    expect(result.availableCash).toBe(-700);
    expect(result.totalValue).toBe(1100);
    expect(result.positions).toEqual([
      {
        ticker: 'ABC',
        name: 'Example S.A.',
        quantity: 10,
        marketValue: 1800,
        performancePct: 20,
        dailyChangePct: expect.closeTo((10 / 170) * 100),
      },
    ]);
  });

  test('returns NOT_FOUND for an unknown user without reading orders or prices', async () => {
    const execute = createGetPortfolio({
      portfolioReader: {
        findUser: async () => null,
        getFilledOrders: async () => {
          throw new Error('orders should not be read');
        },
      },
      marketDataReader: {
        getLatestPrices: async () => {
          throw new Error('prices should not be read');
        },
      },
    });

    await expect(execute(999)).rejects.toBeInstanceOf(NotFoundError);
  });
});
