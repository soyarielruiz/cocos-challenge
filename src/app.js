import express from 'express';
import { PrismaClient } from '@prisma/client';
import { errorHandler, notFoundHandler } from './shared/http/error-handler.js';
import { requestId } from './shared/http/request-id.js';
import { createLogger } from './shared/logger.js';
import { registerHealthRoute } from './features/health/get-health/route.js';

/**
 * @typedef {import('./config.js').AppConfig} AppConfig
 * @typedef {import('./shared/ports.js').DatabaseHealthReader} DatabaseHealthReader
 * @typedef {object} AppComponents
 * @property {import('express').Express} app
 * @property {PrismaClient} prisma
 * @typedef {object} AppOptions
 * @property {(app: import('express').Express) => void} [registerRoutes]
 * @property {DatabaseHealthReader} [healthReader]
 * @property {import('pino').Logger} [logger]
 */

/**
 * @param {AppConfig} config
 * @param {AppOptions} [options]
 * @returns {AppComponents}
 */
export const createApp = (
  config,
  { registerRoutes = () => {}, healthReader, logger = createLogger() } = {},
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
  registerRoutes(app);
  app.use(notFoundHandler());
  app.use(errorHandler(logger));

  return { app, prisma };
};
