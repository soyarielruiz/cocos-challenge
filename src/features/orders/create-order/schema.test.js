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

  test('rejects size less than or equal to zero', () => {
    for (const size of [0, -1]) {
      expect(orderRequestSchema.safeParse({ ...validRequest, size }).success).toBe(false);
    }
  });

  test('rejects non-integer size', () => {
    expect(orderRequestSchema.safeParse({ ...validRequest, size: 1.5 }).success).toBe(false);
  });

  test('rejects amount less than or equal to zero', () => {
    for (const amount of [0, -1]) {
      expect(orderRequestSchema.safeParse({
        ...validRequest,
        size: undefined,
        amount,
      }).success).toBe(false);
    }
  });

  test('rejects requests that provide both size and amount', () => {
    expect(orderRequestSchema.safeParse({
      ...validRequest,
      amount: 10,
    }).success).toBe(false);
  });

  test('rejects requests that provide neither size nor amount', () => {
    expect(orderRequestSchema.safeParse({
      ...validRequest,
      size: undefined,
    }).success).toBe(false);
  });

  test.each([
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

  test('parses a LIMIT request with a positive price', () => {
    const request = {
      ...validRequest,
      type: 'LIMIT',
      price: 12.5,
    };

    expect(orderRequestSchema.parse(request)).toEqual(request);
  });

  test.each([undefined, 0, -1])('rejects LIMIT with price %s', (price) => {
    expect(orderRequestSchema.safeParse({
      ...validRequest,
      type: 'LIMIT',
      price,
    }).success).toBe(false);
  });
});
