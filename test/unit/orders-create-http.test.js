import { Writable } from 'node:stream';
import { afterEach, describe, expect, test } from '@jest/globals';
import pino from 'pino';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const config = {
  port: 3000,
  databaseUrl: 'postgresql://localhost:5432/cocos_test',
};

const instrument = {
  id: 3,
  ticker: 'ABC',
  name: 'Example S.A.',
  type: 'ACCIONES',
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
      findInstrument: async () => instrument,
      getFilledOrders: async () => [
        { side: 'CASH_IN', size: 100, price: '1', instrument: { type: 'MONEDA' } },
      ],
      create: async () => {
        throw error;
      },
    },
    transactionManager: {
      withUserLock: async (_userId, operation) => operation({}),
    },
    marketDataReader: {
      getLatestPrices: async () => [{ instrumentId: instrument.id, close: '10', previousClose: '9' }],
    },
  });
  instances.push(prisma);
  return { app, lines };
};

afterEach(async () => {
  await Promise.all(instances.splice(0).map((prisma) => prisma.$disconnect()));
});

const prismaError = (code) => Object.assign(
  new Error(`Database detail: secret SQL for ${code}`),
  { code, stack: 'STACK_SECRET at /srv/app/db.js' },
);

const postMarketBuy = (app) => request(app)
  .post('/api/orders')
  .send({
    userId: 1,
    instrumentId: instrument.id,
    side: 'BUY',
    type: 'MARKET',
    size: 1,
  });

describe('POST /api/orders error contract', () => {
  test('maps a persistence conflict to RESOURCE_CONFLICT without exposing database details', async () => {
    const { app } = buildApp(prismaError('P2002'));

    const response = await postMarketBuy(app).expect(409);

    expect(response.body.code).toBe('RESOURCE_CONFLICT');
    expect(Object.keys(response.body).sort()).toEqual(['code', 'message']);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(response.body)).not.toMatch(/Database detail|secret SQL|STACK_SECRET/);
  });

  test('maps unexpected persistence errors to a generic response and logs the original error with its request id', async () => {
    const { app, lines } = buildApp(prismaError('P2034'));

    const response = await postMarketBuy(app).expect(500);

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
});
