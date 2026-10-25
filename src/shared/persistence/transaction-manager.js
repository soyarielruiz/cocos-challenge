/**
 * @typedef {import('@prisma/client').PrismaClient} PrismaClient
 * @typedef {import('../ports.js').TransactionManager} TransactionManager
 */

/**
 * @param {PrismaClient} prisma
 * @returns {TransactionManager}
 */
export const createTransactionManager = (prisma) => ({
  withUserLock: (userId, operation) => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT 1 AS locked
      FROM (SELECT pg_advisory_xact_lock(${userId})) AS user_lock
    `;
    return operation(tx);
  }),
});
