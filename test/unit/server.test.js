import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, jest, test } from '@jest/globals';
import { ZodError } from 'zod';
import { registerGracefulShutdown, startServer } from '../../src/server.js';

const databaseUrl = 'postgresql://postgres:postgres@localhost:5432/cocos_challenge?schema=public';

describe('server startup and shutdown', () => {
  test('composes the app from validated config and listens on the configured port', async () => {
    const server = createServer();
    const listening = new Promise((resolve) => server.once('listening', resolve));
    const app = { listen: jest.fn(() => server.listen(0, '127.0.0.1')) };
    const prisma = { $disconnect: jest.fn(async () => {}) };
    const composeApp = jest.fn(() => ({ app, prisma }));
    const signalSource = Object.assign(new EventEmitter(), {
      exitCode: 0,
      stderr: { write: jest.fn() },
    });

    const runtime = startServer({
      env: { DATABASE_LOCAL: databaseUrl, PORT: '4100' },
      composeApp,
      signalSource,
    });
    await listening;

    expect(composeApp).toHaveBeenCalledWith({ databaseUrl, port: 4100 });
    expect(app.listen).toHaveBeenCalledWith(4100);
    expect(runtime.server).toBe(server);
    expect(runtime.prisma).toBe(prisma);

    const disconnected = new Promise((resolve) => {
      prisma.$disconnect.mockImplementation(async () => resolve());
    });
    signalSource.emit('SIGTERM');
    await disconnected;
    expect(server.listening).toBe(false);
  });

  test('rejects invalid configuration before composing or serving the app', () => {
    const composeApp = jest.fn();
    const signalSource = new EventEmitter();

    expect(() =>
      startServer({
        env: { DATABASE_LOCAL: databaseUrl, PORT: 'invalid' },
        composeApp,
        signalSource,
      }),
    ).toThrow(ZodError);
    expect(composeApp).not.toHaveBeenCalled();
    expect(signalSource.listenerCount('SIGINT')).toBe(0);
    expect(signalSource.listenerCount('SIGTERM')).toBe(0);
  });

  test('stops accepting connections, waits for active requests, then disconnects Prisma', async () => {
    let finishRequest;
    let requestStarted;
    const started = new Promise((resolve) => {
      requestStarted = resolve;
    });
    const server = createServer((request, response) => {
      finishRequest = () => {
        response.end('complete');
      };
      requestStarted();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

    const { port } = server.address();
    const responseBody = new Promise((resolve, reject) => {
      const request = fetch(`http://127.0.0.1:${port}`);
      request.then(async (response) => resolve(response.text()), reject);
    });
    await started;

    let disconnected = false;
    const signalSource = Object.assign(new EventEmitter(), {
      exitCode: 0,
      stderr: { write: jest.fn() },
    });
    const shutdown = registerGracefulShutdown(server, {
      $disconnect: async () => {
        disconnected = true;
      },
    }, signalSource);

    try {
      signalSource.emit('SIGTERM');
      expect(disconnected).toBe(false);

      await expect(fetch(`http://127.0.0.1:${port}`)).rejects.toThrow();
      expect(disconnected).toBe(false);

      finishRequest();
      await expect(responseBody).resolves.toBe('complete');
      await shutdown();
      expect(disconnected).toBe(true);
    } finally {
      finishRequest?.();
      await shutdown();
    }
  });
});
