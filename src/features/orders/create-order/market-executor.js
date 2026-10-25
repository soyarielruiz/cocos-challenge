import Decimal from 'decimal.js';
import { InvalidRequestError } from '../../../shared/errors.js';
import { calculateAvailableCash } from '../../../shared/policies/calculate-available-cash.js';
import { orderResponseSchema } from './schema.js';

/**
 * @typedef {import('../../../shared/ports.js').OrderRepository} OrderRepository
 * @typedef {import('../../../shared/ports.js').LatestMarketDataReader} LatestMarketDataReader
 * @typedef {import('../../../shared/ports.js').OrderExecutionContext} OrderExecutionContext
 * @typedef {import('../../../shared/ports.js').PortfolioOrder} PortfolioOrder
 * @typedef {import('./schema.js').OrderResponse} OrderResponse
 */

/**
 * @param {PortfolioOrder[]} filledOrders
 * @param {number} instrumentId
 * @returns {Decimal}
 */
const calculateAvailablePosition = (filledOrders, instrumentId) => filledOrders.reduce((position, order) => {
  if (order.instrument.id !== instrumentId) {
    return position;
  }
  if (order.side === 'BUY') {
    return position.plus(order.size);
  }
  if (order.side === 'SELL') {
    return position.minus(order.size);
  }
  return position;
}, new Decimal(0));

/**
 * @param {object} dependencies
 * @param {OrderRepository} dependencies.orderRepository
 * @param {LatestMarketDataReader} dependencies.marketDataReader
 * @returns {import('../../../shared/ports.js').OrderExecutor}
 */
export const createMarketExecutor = ({ orderRepository, marketDataReader }) => ({
  execute: async ({ request, instrument, tx }) => {
    const isCashInstrument = instrument.type === 'MONEDA';
    let referencePrice = new Decimal(1);
    if (!isCashInstrument) {
      const [marketPrice] = await marketDataReader.getLatestPrices(
        [instrument.id],
        { tx },
      );
      if (!marketPrice) {
        throw new Error(`Latest market data is missing for instrument ${instrument.id}.`);
      }
      referencePrice = new Decimal(marketPrice.close);
    }

    const size = request.amount === undefined
      ? request.size
      : new Decimal(request.amount).div(referencePrice).floor().toNumber();
    if (size === undefined) {
      throw new InvalidRequestError(['size: provide exactly one of size or amount']);
    }

    let status = 'FILLED';
    if (size === 0) {
      status = 'REJECTED';
    } else if (request.side !== 'CASH_IN') {
      const filledOrders = await orderRepository.getFilledOrders(request.userId, { tx });
      if (request.side === 'SELL') {
        if (new Decimal(size).gt(calculateAvailablePosition(filledOrders, instrument.id))) {
          status = 'REJECTED';
        }
      } else {
        const cash = calculateAvailableCash(filledOrders);
        const requiredCash = isCashInstrument
          ? new Decimal(size)
          : new Decimal(size).mul(referencePrice);
        if (requiredCash.gt(cash)) {
          status = 'REJECTED';
        }
      }
    }

    const created = await orderRepository.create({
      userId: request.userId,
      instrumentId: instrument.id,
      size,
      price: referencePrice,
      type: request.type,
      side: request.side,
      status,
    }, { tx });

    return orderResponseSchema.parse({
      id: created.id,
      userId: created.userId,
      instrumentId: created.instrumentId,
      size: created.size,
      price: new Decimal(created.price).toNumber(),
      type: created.type,
      side: created.side,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    });
  },
});
