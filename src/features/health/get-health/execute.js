import { healthResponseSchema } from './schema.js';

/**
 * @typedef {import('../../../shared/ports.js').DatabaseHealthReader} DatabaseHealthReader
 */

/**
 * @param {DatabaseHealthReader} healthReader
 * @returns {() => Promise<{ status: 'ok' }>}
 */
export const createHealthCheck = (healthReader) => async () => {
  await healthReader.ping();
  return healthResponseSchema.parse({ status: 'ok' });
};
