import { Writable } from 'node:stream';
import { afterEach, describe, expect, test } from '@jest/globals';
import pino from 'pino';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const config = {
  port: 3000,
  databaseUrl: 'postgresql://localhost:5432/cocos_test',
};

const instances = [];

const buildApp = (error) => {
  const lines = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  const { app, prisma } = createApp(config, {
    logger: pino(stream),
    orderRepository: {
      findUser: async (userId) => ({ id: userId }),
      findInstrument: async () => null,
      getFilledOrders: async () => [],
      create: async () => null,
      findOwnedOrder: async () => {
        throw error;
      },
      cancelIfNew: async () => null,
    },
    transactionManager: {
      withUserLock: async (_userId, operation) => operation({}),
    },
  });
  instances.push(prisma);
  return { app, lines };
};

afterEach(async () => {
  await Promise.all(instances.splice(0).map((prisma) => prisma.$disconnect()));
});

test('returns a generic 500 and logs cancellation persistence errors with the request ID', async () => {
  const error = Object.assign(
    new Error('Database detail: secret SQL'),
    { code: 'P2034', stack: 'STACK_SECRET at /srv/app/db.js' },
  );
  const { app, lines } = buildApp(error);

  const response = await request(app)
    .post('/api/orders/12/cancel')
    .send({ userId: 7 })
    .expect(500);

  expect(response.body).toEqual({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
  });
  expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  expect(JSON.stringify(response.body)).not.toMatch(/Database detail|secret SQL|STACK_SECRET/);
  const entry = lines.find((line) => line.err);
  expect(entry.reqId).toBe(response.headers['x-request-id']);
  expect(entry.err.message).toContain('secret SQL');
});
