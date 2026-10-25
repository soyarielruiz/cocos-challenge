import express from 'express';
import { PrismaClient } from '@prisma/client';
import { errorHandler, notFoundHandler } from './shared/http/error-handler.js';
import { requestId } from './shared/http/request-id.js';
import { createLogger } from './shared/logger.js';
import { createInstrumentSearchRepository } from './shared/persistence/instrument-search-repository.js';
import { createMarketDataRepository } from './shared/persistence/market-data-repository.js';
import { createOrderRepository } from './shared/persistence/order-repository.js';
import { createPortfolioRepository } from './shared/persistence/portfolio-repository.js';
import { createTransactionManager } from './shared/persistence/transaction-manager.js';
import { registerHealthRoute } from './features/health/get-health/route.js';
import { registerInstrumentSearchRoute } from './features/instruments/search-instruments/route.js';
import { registerCreateOrderRoute } from './features/orders/create-order/route.js';
import { registerGetPortfolioRoute } from './features/users/get-portfolio/route.js';

/**
 * @typedef {import('./config.js').AppConfig} AppConfig
 * @typedef {import('./shared/ports.js').DatabaseHealthReader} DatabaseHealthReader
 * @typedef {import('./shared/ports.js').InstrumentSearchReader} InstrumentSearchReader
 * @typedef {import('./shared/ports.js').PortfolioReader} PortfolioReader
 * @typedef {import('./shared/ports.js').LatestMarketDataReader} LatestMarketDataReader
 * @typedef {import('./shared/ports.js').OrderRepository} OrderRepository
 * @typedef {import('./shared/ports.js').TransactionManager} TransactionManager
 * @typedef {object} AppComponents
 * @property {import('express').Express} app
 * @property {PrismaClient} prisma
 * @typedef {object} AppOptions
 * @property {(app: import('express').Express) => void} [registerRoutes]
 * @property {DatabaseHealthReader} [healthReader]
 * @property {InstrumentSearchReader} [instrumentSearchReader]
 * @property {PortfolioReader} [portfolioReader]
 * @property {LatestMarketDataReader} [marketDataReader]
 * @property {OrderRepository} [orderRepository]
 * @property {TransactionManager} [transactionManager]
 * @property {import('pino').Logger} [logger]
 */

/**
 * @param {AppConfig} config
 * @param {AppOptions} [options]
 * @returns {AppComponents}
 */
export const createApp = (
  config,
  {
    registerRoutes = () => {},
    healthReader,
    instrumentSearchReader,
    portfolioReader,
    marketDataReader,
    orderRepository,
    transactionManager,
    logger = createLogger(),
  } = {},
) => {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: config.databaseUrl },
    },
  });
  const activeMarketDataReader = marketDataReader ?? createMarketDataRepository(prisma);

  const app = express();
  app.use(requestId(logger));
  app.use(express.json());
  registerHealthRoute(app, healthReader ?? {
    ping: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
  });
  registerInstrumentSearchRoute(
    app,
    instrumentSearchReader ?? createInstrumentSearchRepository(prisma),
  );
  registerGetPortfolioRoute(
    app,
    portfolioReader ?? createPortfolioRepository(prisma),
    activeMarketDataReader,
  );
  registerCreateOrderRoute(
    app,
    orderRepository ?? createOrderRepository(prisma),
    transactionManager ?? createTransactionManager(prisma),
    activeMarketDataReader,
  );
  registerRoutes(app);
  app.use(notFoundHandler());
  app.use(errorHandler(logger));

  return { app, prisma };
};
