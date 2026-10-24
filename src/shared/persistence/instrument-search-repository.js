/**
 * @typedef {import('@prisma/client').PrismaClient} PrismaClient
 * @typedef {import('../ports.js').InstrumentSearchReader} InstrumentSearchReader
 */

/**
 * @param {PrismaClient} prisma
 * @returns {InstrumentSearchReader}
 */
export const createInstrumentSearchRepository = (prisma) => ({
  search: async (term) => {
    const pattern = `%${term}%`;
    return prisma.$queryRaw`
      SELECT id, ticker, name, type
      FROM instruments
      WHERE ticker ILIKE ${pattern} OR name ILIKE ${pattern}
      ORDER BY CASE WHEN lower(ticker) = lower(${term}) THEN 0 ELSE 1 END, ticker ASC
    `;
  },
});
