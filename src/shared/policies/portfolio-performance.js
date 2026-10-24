import Decimal from 'decimal.js';

/**
 * @typedef {import('../ports.js').PortfolioOrder} PortfolioOrder
 * @typedef {string | number | { toString: () => string }} DecimalInput
 * @typedef {object} PerformanceResult
 * @property {number | null} performancePct
 * @property {number} dailyChangePct
 */

/**
 * @param {DecimalInput} value
 * @returns {Decimal}
 */
const decimal = (value) => new Decimal(typeof value === 'object' ? value.toString() : value);

/**
 * @param {object} input
 * @param {number} input.quantity
 * @param {PortfolioOrder[]} input.filledOrders
 * @param {DecimalInput} input.close
 * @param {DecimalInput} input.previousClose
 * @returns {PerformanceResult}
 */
export const calculatePerformance = ({ quantity, filledOrders, close, previousClose }) => {
  const latestClose = decimal(close);
  const priorClose = decimal(previousClose);
  if (priorClose.lte(0)) {
    throw new Error('Previous market close must be positive to calculate daily change.');
  }

  const dailyChangePct = latestClose.minus(priorClose).div(priorClose).mul(100).toNumber();
  if (quantity <= 0) {
    return { performancePct: null, dailyChangePct };
  }

  const buys = filledOrders.filter(({ side }) => side === 'BUY');
  const buyQuantity = buys.reduce(
    (total, order) => total.plus(order.size),
    new Decimal(0),
  );
  if (buyQuantity.isZero()) {
    throw new Error('A positive position quantity requires filled buy orders.');
  }

  const buyCost = buys.reduce(
    (total, order) => total.plus(decimal(order.price).mul(order.size)),
    new Decimal(0),
  );
  const weightedAverageBuyPrice = buyCost.div(buyQuantity);
  const performancePct = latestClose
    .minus(weightedAverageBuyPrice)
    .div(weightedAverageBuyPrice)
    .mul(100)
    .toNumber();

  return { performancePct, dailyChangePct };
};
