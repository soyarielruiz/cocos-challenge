import { z } from 'zod';

export const portfolioParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
}).strict();

export const portfolioPositionSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  marketValue: z.number(),
  performancePct: z.number().nullable(),
  dailyChangePct: z.number(),
}).strict();

export const portfolioResponseSchema = z.object({
  userId: z.number().int(),
  totalValue: z.number(),
  availableCash: z.number(),
  positions: z.array(portfolioPositionSchema),
}).strict();

/**
 * @typedef {object} PortfolioPosition
 * @property {string} ticker
 * @property {string} name
 * @property {number} quantity
 * @property {number} marketValue
 * @property {number | null} performancePct
 * @property {number} dailyChangePct
 */

/**
 * @typedef {object} PortfolioResponse
 * @property {number} userId
 * @property {number} totalValue
 * @property {number} availableCash
 * @property {PortfolioPosition[]} positions
 */
