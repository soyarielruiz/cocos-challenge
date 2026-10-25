import Decimal from 'decimal.js';
import { InvalidRequestError } from '../../../shared/errors.js';
import { orderResponseSchema } from './schema.js';

/**
 * @typedef {import('../../../shared/ports.js').OrderRepository} OrderRepository
 * @typedef {import('../../../shared/ports.js').LatestMarketDataReader} LatestMarketDataReader
 * @typedef {import('../../../shared/ports.js').OrderExecutionContext} OrderExecutionContext
 * @typedef {import('./schema.js').OrderResponse} OrderResponse
 */

/**
 * @param {import('../../../shared/ports.js').PortfolioOrder[]} orders
 * @returns {Decimal}
 */
const availableCash = (orders) => orders.reduce((cash, order) => {
  const { instrument, side, size, price } = order;
  if (instrument.type === 'MONEDA') {
    if (side === 'CASH_IN') {
      return cash.plus(size);
    }
    if (side === 'CASH_OUT') {
      return cash.minus(size);
    }
    return cash;
  }
  const tradeValue = new Decimal(size).mul(price);
  if (side === 'BUY') {
    return cash.minus(tradeValue);
  }
  if (side === 'SELL') {
    return cash.plus(tradeValue);
  }
  return cash;
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
      const cash = availableCash(filledOrders);
      const requiredCash = isCashInstrument
        ? new Decimal(size)
        : new Decimal(size).mul(referencePrice);
      if (requiredCash.gt(cash)) {
        status = 'REJECTED';
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
