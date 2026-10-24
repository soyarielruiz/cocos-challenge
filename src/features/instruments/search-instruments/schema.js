import { z } from 'zod';

export const instrumentSearchQuerySchema = z.object({
  search: z.string().min(1),
}).strict();

export const instrumentSummarySchema = z.object({
  id: z.number().int(),
  ticker: z.string(),
  name: z.string(),
  type: z.enum(['ACCIONES', 'MONEDA']),
}).strict();

export const instrumentSearchResponseSchema = z.array(instrumentSummarySchema);
