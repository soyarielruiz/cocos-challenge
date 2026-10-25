import { InvalidRequestError } from '../../../shared/errors.js';

/**
 * @typedef {import('../../../shared/ports.js').OrderExecutor} OrderExecutor
 */

/**
 * @returns {OrderExecutor}
 */
export const createLimitExecutor = () => ({
  execute: async () => {
    throw new InvalidRequestError(['type: LIMIT execution is delivered in EPIC-05']);
  },
});
