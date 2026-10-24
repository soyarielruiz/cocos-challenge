import express from 'express';
import { PrismaClient } from '@prisma/client';
import { errorHandler, notFoundHandler } from './shared/http/error-handler.js';
import { requestId } from './shared/http/request-id.js';
import { createLogger } from './shared/logger.js';
import { createInstrumentSearchRepository } from './shared/persistence/instrument-search-repository.js';
import { registerHealthRoute } from './features/health/get-health/route.js';
import { registerInstrumentSearchRoute } from './features/instruments/search-instruments/route.js';

/**
 * @typedef {import('./config.js').AppConfig} AppConfig
 * @typedef {import('./shared/ports.js').DatabaseHealthReader} DatabaseHealthReader
 * @typedef {import('./shared/ports.js').InstrumentSearchReader} InstrumentSearchReader
 * @typedef {object} AppComponents
 * @property {import('express').Express} app
 * @property {PrismaClient} prisma
 * @typedef {object} AppOptions
 * @property {(app: import('express').Express) => void} [registerRoutes]
 * @property {DatabaseHealthReader} [healthReader]
 * @property {InstrumentSearchReader} [instrumentSearchReader]
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
    logger = createLogger(),
  } = {},
) => {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: config.databaseUrl },
    },
  });

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
  registerRoutes(app);
  app.use(notFoundHandler());
  app.use(errorHandler(logger));

  return { app, prisma };
};
