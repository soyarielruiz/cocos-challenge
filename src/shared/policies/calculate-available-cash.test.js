import { describe, expect, test } from '@jest/globals';
import { calculateAvailableCash } from './calculate-available-cash.js';

const moneda = { id: 66, ticker: 'ARS', name: 'Peso Argentino', type: 'MONEDA' };
const security = { id: 1, ticker: 'ABC', name: 'Example S.A.', type: 'ACCIONES' };

describe('calculateAvailableCash', () => {
  test('nets MONEDA movements and prior security BUY and SELL trade values', () => {
    const cash = calculateAvailableCash([
      { instrument: moneda, side: 'CASH_IN', size: 2000, price: '1' },
      { instrument: moneda, side: 'CASH_OUT', size: 300, price: '1' },
      { instrument: moneda, side: 'BUY', size: 40, price: '1' },
      { instrument: moneda, side: 'SELL', size: 10, price: '1' },
      { instrument: security, side: 'BUY', size: 2, price: '100.25' },
      { instrument: security, side: 'SELL', size: 1, price: '120.50' },
    ]);

    expect(cash.toString()).toBe('1650');
  });

  test('returns zero with no filled orders', () => {
    expect(calculateAvailableCash([]).toString()).toBe('0');
  });
});
