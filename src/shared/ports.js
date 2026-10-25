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
 * @typedef {import('@prisma/client').Prisma.TransactionClient} TransactionClient
 * @typedef {object} TxOpts
 * @property {TransactionClient} [tx]
 */

/**
 * @typedef {object} OrderEntry
 * @property {number} userId
 * @property {number} instrumentId
 * @property {number} size
 * @property {import('decimal.js').default} price
 * @property {'MARKET' | 'LIMIT'} type
 * @property {'BUY' | 'SELL' | 'CASH_IN' | 'CASH_OUT'} side
 * @property {'NEW' | 'FILLED' | 'REJECTED' | 'CANCELLED'} status
 */

/**
 * @typedef {object} OrderExecutionRequest
 * @property {number} userId
 * @property {number} instrumentId
 * @property {'BUY' | 'SELL' | 'CASH_IN' | 'CASH_OUT'} side
 * @property {'MARKET' | 'LIMIT'} type
 * @property {number} [size]
 * @property {number} [amount]
 */

/**
 * @typedef {object} OrderExecutionContext
 * @property {OrderExecutionRequest} request
 * @property {InstrumentSummary} instrument
 * @property {TransactionClient} tx
 */

/**
 * @typedef {object} ExecutedOrder
 * @property {number} id
 * @property {number} userId
 * @property {number} instrumentId
 * @property {number} size
 * @property {number} price
 * @property {'MARKET' | 'LIMIT'} type
 * @property {'BUY' | 'SELL' | 'CASH_IN' | 'CASH_OUT'} side
 * @property {'NEW' | 'FILLED' | 'REJECTED' | 'CANCELLED'} status
 * @property {string} createdAt
 */

/**
 * @typedef {object} OrderExecutor
 * @property {(context: OrderExecutionContext) => Promise<ExecutedOrder>} execute
 */

/**
 * @typedef {object} OrderRepository
 * @property {(userId: number, options?: TxOpts) => Promise<{ id: number } | null>} findUser
 * @property {(instrumentId: number, options?: TxOpts) => Promise<InstrumentSummary | null>} findInstrument
 * @property {(userId: number, options?: TxOpts) => Promise<PortfolioOrder[]>} getFilledOrders
 * @property {(order: OrderEntry, options?: TxOpts) => Promise<{
 *   id: number, userId: number, instrumentId: number, size: number,
 *   price: import('decimal.js').default, type: string, side: string,
 *   status: string, createdAt: Date
 * }>} create
 */

/**
 * @typedef {object} TransactionManager
 * @property {<T>(userId: number, operation: (tx: TransactionClient) => Promise<T>) => Promise<T>} withUserLock
 */

/**
 * @typedef {object} LatestMarketDataReader
 * @property {(instrumentIds: number[], options?: TxOpts) => Promise<LatestMarketPrice[]>} getLatestPrices
 */

export {};
