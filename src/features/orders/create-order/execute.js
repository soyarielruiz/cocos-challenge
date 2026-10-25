import { InvalidRequestError, NotFoundError } from '../../../shared/errors.js';
import { createLimitExecutor } from './limit-executor.js';
import { createMarketExecutor } from './market-executor.js';

/**
 * @typedef {import('../../../shared/ports.js').OrderRepository} OrderRepository
 * @typedef {import('../../../shared/ports.js').TransactionManager} TransactionManager
 * @typedef {import('../../../shared/ports.js').LatestMarketDataReader} LatestMarketDataReader
 * @typedef {import('./schema.js').OrderRequest} OrderRequest
 * @typedef {import('./schema.js').OrderResponse} OrderResponse
 */

/**
 * @param {object} dependencies
 * @param {OrderRepository} dependencies.orderRepository
 * @param {TransactionManager} dependencies.transactionManager
 * @param {LatestMarketDataReader} dependencies.marketDataReader
 * @returns {(request: OrderRequest) => Promise<OrderResponse>}
 */
export const createOrder = ({ orderRepository, transactionManager, marketDataReader }) => {
  const executors = new Map([
    ['MARKET', createMarketExecutor({ orderRepository, marketDataReader })],
    ['LIMIT', createLimitExecutor()],
  ]);

  return async (request) => transactionManager.withUserLock(request.userId, async (tx) => {
    const user = await orderRepository.findUser(request.userId, { tx });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const instrument = await orderRepository.findInstrument(request.instrumentId, { tx });
    if (!instrument) {
      throw new NotFoundError('Instrument not found');
    }

    const isCashInstrument = instrument.type === 'MONEDA';
    const isCashSide = request.side === 'CASH_IN' || request.side === 'CASH_OUT';
    if (isCashSide !== isCashInstrument) {
      throw new InvalidRequestError([
        `instrumentId: ${isCashSide ? 'cash operations require MONEDA' : 'BUY and SELL require a security instrument'}`,
      ]);
    }
    if (request.side === 'SELL') {
      throw new InvalidRequestError(['side: SELL orders are not supported by this session yet']);
    }

    const executor = executors.get(request.type);
    if (!executor) {
      throw new InvalidRequestError([`type: ${request.type} orders are not supported by this session`]);
    }
    return executor.execute({ request, instrument, tx });
  });
};
