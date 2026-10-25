import { z } from 'zod';

export const cancelOrderParamsSchema = z.object({
  id: z.string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().safe()),
}).strict();

export const cancelOrderRequestSchema = z.object({
  userId: z.number().int(),
}).strict();

/**
 * @typedef {object} CancelOrderRequest
 * @property {number} id
 * @property {number} userId
 */
