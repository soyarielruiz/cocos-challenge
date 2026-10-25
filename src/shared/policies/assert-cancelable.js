import { OrderNotCancellableError } from '../errors.js';

/**
 * @param {string} status
 * @returns {void}
 */
export const assertCancelable = (status) => {
  if (status !== 'NEW') {
    throw new OrderNotCancellableError();
  }
};
