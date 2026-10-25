import { z } from 'zod';

export const orderRequestSchema = z.object({
  userId: z.number().int().positive(),
  instrumentId: z.number().int().positive(),
  side: z.enum(['BUY', 'SELL', 'CASH_IN', 'CASH_OUT']),
  type: z.enum(['MARKET', 'LIMIT']),
  size: z.number().int().positive().optional(),
  amount: z.number().finite().positive().optional(),
  price: z.number().finite().positive().optional(),
}).strict().superRefine((request, context) => {
  const hasSize = request.size !== undefined;
  const hasAmount = request.amount !== undefined;
  if (hasSize === hasAmount) {
    context.addIssue({
      code: 'custom',
      path: [hasSize ? 'amount' : 'size'],
      message: 'provide exactly one of size or amount',
    });
  }
  if (request.type === 'MARKET' && request.price !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['price'],
      message: 'price is not allowed for MARKET orders',
    });
  }
  if (request.type === 'LIMIT' && request.price === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['price'],
      message: 'price is required for LIMIT orders',
    });
  }
  if (request.type === 'LIMIT' && (request.side === 'CASH_IN' || request.side === 'CASH_OUT')) {
    context.addIssue({
      code: 'custom',
      path: ['type'],
      message: 'cash operations require MARKET orders',
    });
  }
});

export const orderResponseSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  instrumentId: z.number().int(),
  size: z.number().int().nonnegative(),
  price: z.number().positive(),
  type: z.enum(['MARKET', 'LIMIT']),
  side: z.enum(['BUY', 'SELL', 'CASH_IN', 'CASH_OUT']),
  status: z.enum(['NEW', 'FILLED', 'REJECTED', 'CANCELLED']),
  createdAt: z.string().datetime(),
}).strict();

/**
 * @typedef {object} OrderRequest
 * @property {number} userId
 * @property {number} instrumentId
 * @property {'BUY' | 'SELL' | 'CASH_IN' | 'CASH_OUT'} side
 * @property {'MARKET' | 'LIMIT'} type
 * @property {number} [size]
 * @property {number} [amount]
 * @property {number} [price]
 */

/**
 * @typedef {object} OrderResponse
 * @property {number} id
 * @property {number} userId
 * @property {number} instrumentId
 * @property {number} size
 * @property {number} price
 * @property {'MARKET' | 'LIMIT'} type
 * @property {'BUY' | 'SELL' | 'CASH_IN' | 'CASH_OUT'} side
 * @property {'NEW' | 'FILLED' | 'REJECTED' | 'CANCELLED'} status
 * @property {string} createdAt
 */
