import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { ZodError } from 'zod';
import { createApp } from './app.js';
import { parseConfig } from './config.js';

/**
 * @typedef {Pick<NodeJS.Process, 'once' | 'stderr' | 'exitCode'>} SignalSource
 * @typedef {import('node:http').Server} HttpServer
 * @typedef {{ $disconnect: () => Promise<void> }} DisconnectablePrisma
 */

/**
 * @param {HttpServer} server
 * @param {DisconnectablePrisma} prisma
 * @param {SignalSource} [signalSource=process]
 * @returns {() => Promise<void>}
 */
export const registerGracefulShutdown = (server, prisma, signalSource = process) => {
  /** @type {Promise<void> | undefined} */
  let shutdownPromise;

  const shutdown = () => {
    if (!shutdownPromise) {
      shutdownPromise = new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      })
        .then(() => prisma.$disconnect())
        .catch((error) => {
          signalSource.exitCode = 1;
          const message = error instanceof Error ? error.message : String(error);
          signalSource.stderr.write(`Graceful shutdown failed: ${message}\n`);
        });
    }
    return shutdownPromise;
  };

  signalSource.once('SIGINT', shutdown);
  signalSource.once('SIGTERM', shutdown);
  return shutdown;
};

/**
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   composeApp?: typeof createApp,
 *   signalSource?: SignalSource
 * }} [options]
 * @returns {{ server: HttpServer, prisma: import('@prisma/client').PrismaClient }}
 */
export const startServer = ({ env = process.env, composeApp = createApp, signalSource = process } = {}) => {
  const config = parseConfig(env);
  const { app, prisma } = composeApp(config);
  const server = app.listen(config.port);
  registerGracefulShutdown(server, prisma, signalSource);
  return { server, prisma };
};

const formatStartupError = (error) => {
  if (error instanceof ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join('.') || 'configuration'}: ${issue.message}`)
      .join('\n');
  }
  return error instanceof Error ? error.message : String(error);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    startServer();
  } catch (error) {
    process.stderr.write(`Startup failed:\n${formatStartupError(error)}\n`);
    process.exitCode = 1;
  }
}
