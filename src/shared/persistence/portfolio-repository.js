/**
 * @typedef {import('@prisma/client').PrismaClient} PrismaClient
 * @typedef {import('../ports.js').PortfolioReader} PortfolioReader
 */

/**
 * @param {PrismaClient} prisma
 * @returns {PortfolioReader}
 */
export const createPortfolioRepository = (prisma) => ({
  findUser: (userId) => prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  }),
  getFilledOrders: (userId) => prisma.order.findMany({
    where: { userId, status: 'FILLED' },
    select: {
      size: true,
      side: true,
      price: true,
      instrument: {
        select: { id: true, ticker: true, name: true, type: true },
      },
    },
  }),
});
