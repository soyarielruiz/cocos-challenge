import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import 'dotenv/config';
import request from 'supertest';
import { createApp } from '../../src/app.js';

if (!process.env.DATABASE_LOCAL) {
  throw new Error('DATABASE_LOCAL must point to the local development database.');
}

const { app, prisma } = createApp({
  databaseUrl: process.env.DATABASE_LOCAL,
  port: 3000,
});

const fixtureEmail = 'limit-order-s1@example.test';
const fixtureTicker = 'LIMS1';
let user;
let foreignUser;
let instrument;

const submit = (body) => request(app).post('/api/orders').send(body);

beforeAll(async () => {
  await prisma.$connect();
  user = await prisma.user.create({
    data: { email: fixtureEmail, accountNumber: 'LIMIT-S1' },
  });
  foreignUser = await prisma.user.create({
    data: { email: 'limit-order-s2-foreign@example.test', accountNumber: 'LIMIT-S2-FOREIGN' },
  });
  instrument = await prisma.instrument.create({
    data: {
      ticker: fixtureTicker,
      name: 'LIMIT order integration fixture',
      type: 'ACCIONES',
    },
  });
});

afterAll(async () => {
  if (user) {
    await prisma.order.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  if (foreignUser) {
    await prisma.order.deleteMany({ where: { userId: foreignUser.id } });
    await prisma.user.delete({ where: { id: foreignUser.id } });
  }
  if (instrument) {
    await prisma.marketData.deleteMany({ where: { instrumentId: instrument.id } });
    await prisma.instrument.delete({ where: { id: instrument.id } });
  }
  await prisma.$disconnect();
});

describe('POST /api/orders LIMIT', () => {
  const baseRequest = () => ({
    userId: user.id,
    instrumentId: instrument.id,
    side: 'BUY',
    type: 'LIMIT',
  });

  test('persists a positive-size LIMIT order as NEW at its price without cash or market data', async () => {
    const response = await submit({
      ...baseRequest(),
      size: 10,
      price: 12.5,
    }).expect(201);

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body).toMatchObject({
      userId: user.id,
      instrumentId: instrument.id,
      size: 10,
      price: 12.5,
      type: 'LIMIT',
      side: 'BUY',
      status: 'NEW',
    });
    const persisted = await prisma.order.findUnique({ where: { id: response.body.id } });
    expect(persisted).toMatchObject({ size: 10, type: 'LIMIT', status: 'NEW' });
    expect(persisted.price.toString()).toBe('12.5');
  });

  test('floors amount using limit price and persists a zero-size order as REJECTED', async () => {
    const base = baseRequest();
    const floored = await submit({ ...base, amount: 1, price: 0.3 }).expect(201);
    expect(floored.body).toMatchObject({ size: 3, price: 0.3, status: 'NEW' });

    const zero = await submit({ ...base, amount: 0.29, price: 0.3 }).expect(201);
    expect(zero.body).toMatchObject({ size: 0, price: 0.3, status: 'REJECTED' });
    const persistedZero = await prisma.order.findUnique({ where: { id: zero.body.id } });
    expect(persistedZero).toMatchObject({ size: 0, type: 'LIMIT', status: 'REJECTED' });
    expect(persistedZero.price.toString()).toBe('0.3');
  });

  test.each([
    ['missing price', {}],
    ['zero price', { price: 0 }],
    ['negative price', { price: -1 }],
  ])('returns 400 INVALID_REQUEST for %s', async (_label, fields) => {
    const response = await submit({ ...baseRequest(), size: 1, ...fields }).expect(400);

    expect(response.body.code).toBe('INVALID_REQUEST');
    expect(response.body.details).toEqual(expect.arrayContaining([
      expect.stringMatching(/^price:/),
    ]));
    expect(response.headers['x-request-id']).toBeDefined();
  });

  test('rejects price on MARKET and enforces size/amount XOR', async () => {
    const market = await submit({
      ...baseRequest(),
      type: 'MARKET',
      size: 1,
      price: 12.5,
    }).expect(400);
    expect(market.body.code).toBe('INVALID_REQUEST');

    const both = await submit({
      ...baseRequest(),
      size: 1,
      amount: 10,
      price: 12.5,
    }).expect(400);
    expect(both.body.code).toBe('INVALID_REQUEST');

    const neither = await submit({
      ...baseRequest(),
      price: 12.5,
    }).expect(400);
    expect(neither.body.code).toBe('INVALID_REQUEST');
  });

  test('returns 404 NOT_FOUND for unknown user and instrument', async () => {
    const missingUser = await submit({
      ...baseRequest(),
      userId: 99999999,
      size: 1,
      price: 12.5,
    }).expect(404);
    expect(missingUser.body.code).toBe('NOT_FOUND');

    const missingInstrument = await submit({
      ...baseRequest(),
      instrumentId: 99999999,
      size: 1,
      price: 12.5,
    }).expect(404);
    expect(missingInstrument.body.code).toBe('NOT_FOUND');
  });
});

describe('POST /api/orders/:id/cancel', () => {
  const createOrder = (overrides = {}) => prisma.order.create({
    data: {
      userId: user.id,
      instrumentId: instrument.id,
      size: 1,
      price: 12.5,
      type: 'LIMIT',
      side: 'BUY',
      status: 'NEW',
      ...overrides,
    },
  });

  const cancel = (id, userId = user.id) => request(app)
    .post(`/api/orders/${id}/cancel`)
    .send({ userId });

  test('cancels and persists an owned NEW LIMIT order', async () => {
    const pending = await createOrder();

    const response = await cancel(pending.id).expect(200);

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body).toMatchObject({
      id: pending.id,
      userId: user.id,
      type: 'LIMIT',
      status: 'CANCELLED',
    });
    expect(await prisma.order.findUnique({ where: { id: pending.id } }))
      .toMatchObject({ status: 'CANCELLED' });
  });

  test('returns the same non-disclosing 404 for missing and foreign orders', async () => {
    const foreign = await createOrder({ userId: foreignUser.id });

    const foreignResponse = await cancel(foreign.id).expect(404);
    const missingResponse = await cancel(foreign.id + 100000).expect(404);

    expect(foreignResponse.body.code).toBe('NOT_FOUND');
    expect(foreignResponse.body).toEqual(missingResponse.body);
    expect(foreignResponse.headers['x-request-id']).toBeDefined();
    expect(missingResponse.headers['x-request-id']).toBeDefined();
    expect(await prisma.order.findUnique({ where: { id: foreign.id } }))
      .toMatchObject({ status: 'NEW' });
  });

  test.each(['FILLED', 'REJECTED', 'CANCELLED'])(
    'returns 409 ORDER_NOT_CANCELLABLE for a %s order',
    async (status) => {
      const unavailable = await createOrder({ status });

      const response = await cancel(unavailable.id).expect(409);

      expect(response.body.code).toBe('ORDER_NOT_CANCELLABLE');
      expect(response.headers['x-request-id']).toBeDefined();
      expect(await prisma.order.findUnique({ where: { id: unavailable.id } }))
        .toMatchObject({ status });
    },
  );

  test('returns safe validation errors with request IDs for invalid IDs and bodies', async () => {
    const invalidId = await cancel('not-an-id').expect(400);
    const invalidBody = await request(app)
      .post('/api/orders/1/cancel')
      .send({ userId: 'not-an-integer' })
      .expect(400);

    for (const response of [invalidId, invalidBody]) {
      expect(response.body.code).toBe('INVALID_REQUEST');
      expect(response.headers['x-request-id']).toBeDefined();
    }
  });
});
