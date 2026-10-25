import Decimal from 'decimal.js';

/**
 * @typedef {import('../ports.js').PortfolioOrder} PortfolioOrder
 */

/**
 * @param {PortfolioOrder[]} filledOrders
 * @returns {Decimal}
 */
export const calculateAvailableCash = (filledOrders) => filledOrders.reduce((cash, order) => {
  const { instrument, side, size, price } = order;
  if (instrument.type === 'MONEDA') {
    if (side === 'BUY' || side === 'CASH_IN') {
      return cash.plus(size);
    }
    return cash.minus(size);
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
