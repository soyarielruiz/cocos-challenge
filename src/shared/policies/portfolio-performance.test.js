import { describe, expect, test } from '@jest/globals';
import { calculatePerformance } from './portfolio-performance.js';

describe('calculatePerformance', () => {
  test('uses volume-weighted buy cost and leaves it unchanged by sales', () => {
    const result = calculatePerformance({
      quantity: 10,
      filledOrders: [
        { side: 'BUY', size: 10, price: '100' },
        { side: 'BUY', size: 10, price: '200' },
        { side: 'SELL', size: 10, price: '150' },
      ],
      close: '180',
      previousClose: '170',
    });

    expect(result.performancePct).toBeCloseTo(20);
    expect(result.dailyChangePct).toBeCloseTo((10 / 170) * 100);
  });

  test('returns null performance for zero and negative quantities', () => {
    for (const quantity of [0, -10]) {
      const result = calculatePerformance({
        quantity,
        filledOrders: [{ side: 'BUY', size: 10, price: '100' }],
        close: '110',
        previousClose: '100',
      });

      expect(result.performancePct).toBeNull();
      expect(result.dailyChangePct).toBeCloseTo(10);
    }
  });
});
