import { describe, expect, test } from '@jest/globals';
import { orderRequestSchema } from './schema.js';

const validRequest = {
  userId: 1,
  instrumentId: 2,
  side: 'BUY',
  type: 'MARKET',
  size: 1,
};

describe('order request schema', () => {
  test('parses a MARKET request with exactly one positive size or amount', () => {
    expect(orderRequestSchema.parse(validRequest)).toEqual(validRequest);
    expect(orderRequestSchema.parse({
      userId: 1,
      instrumentId: 2,
      side: 'BUY',
      type: 'MARKET',
      amount: 10.25,
    })).toMatchObject({ amount: 10.25 });
  });

  test.each([
    ['neither size nor amount', { size: undefined }],
    ['both size and amount', { size: 1, amount: 10 }],
    ['zero size', { size: 0 }],
    ['fractional size', { size: 1.5 }],
    ['zero amount', { amount: 0 }],
    ['negative amount', { amount: -1 }],
    ['price on MARKET', { price: 10 }],
    ['unknown field', { privateField: 'value' }],
  ])('rejects %s', (_label, fields) => {
    expect(() => orderRequestSchema.parse({ ...validRequest, ...fields })).toThrow();
  });

  test('rejects LIMIT cash operations as INVALID_REQUEST', () => {
    expect(() => orderRequestSchema.parse({
      ...validRequest,
      side: 'CASH_IN',
      type: 'LIMIT',
      size: 10,
      price: 1,
    })).toThrow();
  });
});
