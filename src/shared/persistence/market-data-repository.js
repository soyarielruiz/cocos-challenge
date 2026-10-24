import { Prisma } from '@prisma/client';

/**
 * @typedef {import('@prisma/client').PrismaClient} PrismaClient
 * @typedef {import('../ports.js').LatestMarketDataReader} LatestMarketDataReader
 */

/**
 * @param {PrismaClient} prisma
 * @returns {LatestMarketDataReader}
 */
export const createMarketDataRepository = (prisma) => ({
  getLatestPrices: async (instrumentIds) => {
    if (instrumentIds.length === 0) {
      return [];
    }

    const rows = await prisma.$queryRaw`
      SELECT DISTINCT ON ("instrument_id")
        "instrument_id" AS "instrumentId",
        "close"::text AS "close",
        "previous_close"::text AS "previousClose"
      FROM marketdata
      WHERE "instrument_id" IN (${Prisma.join(instrumentIds)})
      ORDER BY "instrument_id", "market_date" DESC
    `;
    return rows.map(({ instrumentId, close, previousClose }) => ({
      instrumentId,
      close: String(close),
      previousClose: String(previousClose),
    }));
  },
});
