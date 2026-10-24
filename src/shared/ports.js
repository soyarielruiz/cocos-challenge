/**
 * @typedef {object} DatabaseHealthReader
 * @property {() => Promise<void>} ping
 */

/**
 * @typedef {object} InstrumentSummary
 * @property {number} id
 * @property {string} ticker
 * @property {string} name
 * @property {'ACCIONES' | 'MONEDA'} type
 */

/**
 * @typedef {object} InstrumentSearchReader
 * @property {(term: string) => Promise<InstrumentSummary[]>} search
 */

/**
 * @typedef {object} PortfolioOrder
 * @property {InstrumentSummary} instrument
 * @property {number} size
 * @property {'BUY' | 'SELL' | 'CASH_IN' | 'CASH_OUT'} side
 * @property {string | number | { toString: () => string }} price
 */

/**
 * @typedef {object} PortfolioReader
 * @property {(userId: number) => Promise<{ id: number } | null>} findUser
 * @property {(userId: number) => Promise<PortfolioOrder[]>} getFilledOrders
 */

/**
 * @typedef {object} LatestMarketPrice
 * @property {number} instrumentId
 * @property {string} close
 * @property {string} previousClose
 */

/**
 * @typedef {object} LatestMarketDataReader
 * @property {(instrumentIds: number[]) => Promise<LatestMarketPrice[]>} getLatestPrices
 */

export {};
