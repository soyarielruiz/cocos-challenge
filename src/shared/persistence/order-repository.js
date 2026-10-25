/**
 * @typedef {import('@prisma/client').PrismaClient} PrismaClient
 * @typedef {import('../ports.js').OrderRepository} OrderRepository
 * @typedef {import('../ports.js').TxOpts} TxOpts
 */

/**
 * @param {PrismaClient} prisma
 * @returns {OrderRepository}
 */
export const createOrderRepository = (prisma) => {
  const client = ({ tx } = {}) => tx ?? prisma;

  return {
    findUser: (userId, options) => client(options).user.findUnique({
      where: { id: userId },
      select: { id: true },
    }),
    findInstrument: (instrumentId, options) => client(options).instrument.findUnique({
      where: { id: instrumentId },
      select: { id: true, ticker: true, name: true, type: true },
    }),
    getFilledOrders: (userId, options) => client(options).order.findMany({
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
    create: (data, options) => client(options).order.create({ data }),
    findOwnedOrder: (orderId, userId, options) => client(options).order.findFirst({
      where: { id: orderId, userId },
    }),
    cancelIfNew: async (orderId, userId, options) => {
      const database = client(options);
      const result = await database.order.updateMany({
        where: { id: orderId, userId, status: 'NEW' },
        data: { status: 'CANCELLED' },
      });
      if (result.count !== 1) {
        return null;
      }
      return database.order.findUnique({ where: { id: orderId } });
    },
  };
};
