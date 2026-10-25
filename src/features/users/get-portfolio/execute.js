import Decimal from 'decimal.js';
import { NotFoundError } from '../../../shared/errors.js';
import { calculateAvailableCash } from '../../../shared/policies/calculate-available-cash.js';
import { calculatePerformance } from '../../../shared/policies/portfolio-performance.js';
import { portfolioResponseSchema } from './schema.js';

/**
 * @typedef {import('../../../shared/ports.js').PortfolioReader} PortfolioReader
 * @typedef {import('../../../shared/ports.js').LatestMarketDataReader} LatestMarketDataReader
 * @typedef {import('../../../shared/ports.js').PortfolioOrder} PortfolioOrder
 * @typedef {import('./schema.js').PortfolioResponse} PortfolioResponse
 */

/**
 * @param {PortfolioOrder} order
 * @returns {number}
 */
const orderSign = ({ side }) => (side === 'BUY' || side === 'CASH_IN' ? 1 : -1);

/**
 * @param {object} dependencies
 * @param {PortfolioReader} dependencies.portfolioReader
 * @param {LatestMarketDataReader} dependencies.marketDataReader
 * @returns {(userId: number) => Promise<PortfolioResponse>}
 */
export const createGetPortfolio = ({ portfolioReader, marketDataReader }) => async (userId) => {
  const user = await portfolioReader.findUser(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const filledOrders = await portfolioReader.getFilledOrders(userId);
  const cash = calculateAvailableCash(filledOrders);
  const positionsByInstrument = new Map();

  for (const order of filledOrders) {
    const { instrument, size } = order;
    const signedSize = new Decimal(size).mul(orderSign(order));
    if (instrument.type === 'MONEDA') {
      continue;
    }

    const position = positionsByInstrument.get(instrument.id) ?? {
      instrument,
      quantity: new Decimal(0),
      orders: [],
    };
    position.quantity = position.quantity.plus(signedSize);
    position.orders.push(order);
    positionsByInstrument.set(instrument.id, position);
  }

  const positions = [...positionsByInstrument.values()];
  const instrumentIds = positions.map(({ instrument }) => instrument.id).sort((a, b) => a - b);
  const prices = await marketDataReader.getLatestPrices(instrumentIds);
  const pricesByInstrument = new Map(prices.map((price) => [price.instrumentId, price]));

  const responsePositions = positions.map(({ instrument, quantity, orders }) => {
    const marketData = pricesByInstrument.get(instrument.id);
    if (!marketData) {
      throw new Error(`Latest market data is missing for instrument ${instrument.id}.`);
    }
    const quantityValue = quantity.toNumber();
    const marketValue = new Decimal(marketData.close).mul(quantity).toNumber();
    const { performancePct, dailyChangePct } = calculatePerformance({
      quantity: quantityValue,
      filledOrders: orders,
      close: marketData.close,
      previousClose: marketData.previousClose,
    });

    return {
      ticker: instrument.ticker,
      name: instrument.name,
      quantity: quantityValue,
      marketValue,
      performancePct,
      dailyChangePct,
    };
  }).sort((left, right) => left.ticker.localeCompare(right.ticker));

  const availableCash = cash.toNumber();
  const totalValue = responsePositions.reduce(
    (total, position) => total.plus(position.marketValue),
    cash,
  ).toNumber();

  return portfolioResponseSchema.parse({
    userId: user.id,
    totalValue,
    availableCash,
    positions: responsePositions,
  });
};
