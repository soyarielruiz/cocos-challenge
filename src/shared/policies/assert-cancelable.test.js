import { describe, expect, test } from '@jest/globals';
import { OrderNotCancellableError } from '../errors.js';
import { assertCancelable } from './assert-cancelable.js';

describe('assertCancelable', () => {
  test('accepts an order in NEW status', () => {
    expect(() => assertCancelable('NEW')).not.toThrow();
  });

  test.each(['FILLED', 'REJECTED', 'CANCELLED'])(
    'rejects an order in %s status',
    (status) => {
      expect(() => assertCancelable(status)).toThrow(OrderNotCancellableError);
    },
  );
});
