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

const marketIntegrationTimeout = process.env.DATABASE_TEST ? 15_000 : 5_000;
let currency;
let sequence = 0;
const fixtureUserIds = [];
const fixtureInstrumentIds = [];
const createFixture = async ({ price = '20', cash = 1000, position = 0 } = {}) => {
  sequence += 1;
  const [user, instrument] = await Promise.all([
    prisma.user.create({
      data: {
        email: `market-order-s1-${sequence}@example.test`,
        accountNumber: `S1-${sequence}`,
      },
    }),
    prisma.instrument.create({
      data: {
        ticker: `S1T${String(sequence).padStart(3, '0')}`,
        name: `Order integration fixture ${sequence}`,
        type: 'ACCIONES',
      },
    }),
  ]);
  fixtureUserIds.push(user.id);
  fixtureInstrumentIds.push(instrument.id);
  const fixtureOrders = [
    prisma.marketData.create({
      data: {
        instrumentId: instrument.id,
        high: price,
        low: price,
        open: price,
        close: price,
        previousClose: price,
        marketDate: new Date(`2099-01-${String(sequence).padStart(2, '0')}`),
      },
    }),
    prisma.order.create({
      data: {
        userId: user.id,
        instrumentId: currency.id,
        size: cash,
        price: 1,
        type: 'MARKET',
        side: 'CASH_IN',
        status: 'FILLED',
      },
    }),
  ];
  if (position > 0) {
    fixtureOrders.push(prisma.order.create({
      data: {
        userId: user.id,
        instrumentId: instrument.id,
        size: position,
        price,
        type: 'MARKET',
        side: 'BUY',
        status: 'FILLED',
      },
    }));
  }
  await Promise.all(fixtureOrders);

  return { user, instrument };
};

const createFundedUser = async (cash) => {
  sequence += 1;
  const user = await prisma.user.create({
    data: {
      email: `market-order-s2-${sequence}@example.test`,
      accountNumber: `S2-${sequence}`,
    },
  });
  fixtureUserIds.push(user.id);
  await prisma.order.create({
    data: {
      userId: user.id,
      instrumentId: currency.id,
      size: cash,
      price: 1,
      type: 'MARKET',
      side: 'CASH_IN',
      status: 'FILLED',
    },
  });
  return user;
};

const submit = (body) => request(app).post('/api/orders').send(body);

beforeAll(async () => {
  await prisma.$connect();
  currency = await prisma.instrument.findFirst({
    where: { type: 'MONEDA' },
    select: { id: true },
  });
  if (!currency) {
    throw new Error('The deterministic local seed must include a MONEDA instrument.');
  }
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { userId: { in: fixtureUserIds } } });
  await prisma.marketData.deleteMany({ where: { instrumentId: { in: fixtureInstrumentIds } } });
  await prisma.instrument.deleteMany({ where: { id: { in: fixtureInstrumentIds } } });
  await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
  await prisma.$disconnect();
});

describe('POST /api/orders MARKET', () => {
  test('fills a funded BUY, persists an insufficient-cash rejection, and reflects both in derived cash', async () => {
    const { user, instrument } = await createFixture({ cash: 100 });

    const filled = await submit({
      userId: user.id,
      instrumentId: instrument.id,
      side: 'BUY',
      type: 'MARKET',
      size: 2,
    }).expect(201);
    expect(filled.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(filled.body).toMatchObject({
      userId: user.id,
      instrumentId: instrument.id,
      side: 'BUY',
      type: 'MARKET',
      size: 2,
      price: 20,
      status: 'FILLED',
    });

    const rejected = await submit({
      userId: user.id,
      instrumentId: instrument.id,
      side: 'BUY',
      type: 'MARKET',
      size: 5,
    }).expect(201);
    expect(rejected.body.status).toBe('REJECTED');
    expect(await prisma.order.findUnique({ where: { id: rejected.body.id } }))
      .toMatchObject({ status: 'REJECTED', size: 5 });

    const portfolio = await request(app).get(`/api/users/${user.id}/portfolio`).expect(200);
    expect(portfolio.body.availableCash).toBe(60);
  }, marketIntegrationTimeout);

  test('floors amount and persists a floored zero size as REJECTED', async () => {
    const { user, instrument } = await createFixture({ price: '0.30', cash: 10 });
    const base = {
      userId: user.id,
      instrumentId: instrument.id,
      side: 'BUY',
      type: 'MARKET',
    };

    const floored = await submit({ ...base, amount: 1 }).expect(201);
    expect(floored.body).toMatchObject({ size: 3, price: 0.3, status: 'FILLED' });

    const zero = await submit({ ...base, amount: 0.29 }).expect(201);
    expect(zero.body).toMatchObject({ size: 0, status: 'REJECTED' });
    expect(await prisma.order.findUnique({ where: { id: zero.body.id } }))
      .toMatchObject({ size: 0, status: 'REJECTED' });
  }, marketIntegrationTimeout);

  test('fills integer CASH_IN and validates CASH_OUT against derived cash', async () => {
    const { user } = await createFixture({ cash: 1000 });
    const cashRequest = {
      userId: user.id,
      instrumentId: currency.id,
      type: 'MARKET',
      side: 'CASH_OUT',
    };

    const withdrawal = await submit({ ...cashRequest, size: 200 }).expect(201);
    expect(withdrawal.body).toMatchObject({
      instrumentId: currency.id,
      size: 200,
      price: 1,
      status: 'FILLED',
    });

    const rejected = await submit({ ...cashRequest, size: 1000 }).expect(201);
    expect(rejected.body.status).toBe('REJECTED');

    const deposit = await submit({
      ...cashRequest,
      side: 'CASH_IN',
      size: 50,
    }).expect(201);
    expect(deposit.body.status).toBe('FILLED');

    const portfolio = await request(app).get(`/api/users/${user.id}/portfolio`).expect(200);
    expect(portfolio.body.availableCash).toBe(850);
  }, marketIntegrationTimeout);

  test('serializes concurrent BUYs for one user so they cannot double-spend', async () => {
    const { user, instrument } = await createFixture({ cash: 1000 });
    const body = {
      userId: user.id,
      instrumentId: instrument.id,
      side: 'BUY',
      type: 'MARKET',
      size: 30,
    };

    const responses = await Promise.all([submit(body), submit(body)]);
    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    expect(responses.map(({ body: order }) => order.status).sort()).toEqual(['FILLED', 'REJECTED']);
    const filledOrders = await prisma.order.findMany({
      where: { userId: user.id, side: 'BUY', status: 'FILLED' },
    });
    expect(filledOrders.reduce((total, order) => total + order.size * Number(order.price), 0))
      .toBeLessThanOrEqual(1000);
  });

  test('fills SELLs with available positions and persists insufficient positions as REJECTED', async () => {
    const { user, instrument } = await createFixture({ cash: 1000, position: 5 });
    const base = {
      userId: user.id,
      instrumentId: instrument.id,
      side: 'SELL',
      type: 'MARKET',
    };

    const filled = await submit({ ...base, size: 3 }).expect(201);
    expect(filled.body).toMatchObject({ side: 'SELL', size: 3, price: 20, status: 'FILLED' });

    const rejected = await submit({ ...base, size: 3 }).expect(201);
    expect(rejected.body).toMatchObject({ side: 'SELL', size: 3, status: 'REJECTED' });
    expect(await prisma.order.findUnique({ where: { id: rejected.body.id } }))
      .toMatchObject({ side: 'SELL', status: 'REJECTED', size: 3 });

    const portfolio = await request(app).get(`/api/users/${user.id}/portfolio`).expect(200);
    expect(portfolio.body.positions).toContainEqual(expect.objectContaining({ quantity: 2 }));
    expect(portfolio.body.availableCash).toBe(960);
  }, marketIntegrationTimeout);

  test('serializes concurrent SELLs for one user so they cannot oversell positions', async () => {
    const { user, instrument } = await createFixture({ cash: 1000, position: 30 });
    const body = {
      userId: user.id,
      instrumentId: instrument.id,
      side: 'SELL',
      type: 'MARKET',
      size: 20,
    };

    const responses = await Promise.all([submit(body), submit(body)]);
    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    expect(responses.map(({ body: order }) => order.status).sort()).toEqual(['FILLED', 'REJECTED']);
    const filledSales = await prisma.order.findMany({
      where: { userId: user.id, side: 'SELL', status: 'FILLED' },
    });
    expect(filledSales.reduce((total, order) => total + order.size, 0)).toBeLessThanOrEqual(30);
  });

  test('allows different users to buy the same instrument without inventory contention', async () => {
    const { user: firstUser, instrument } = await createFixture({ cash: 1000 });
    const secondUser = await createFundedUser(1000);
    const body = {
      instrumentId: instrument.id,
      side: 'BUY',
      type: 'MARKET',
      size: 30,
    };

    const responses = await Promise.all([
      submit({ ...body, userId: firstUser.id }),
      submit({ ...body, userId: secondUser.id }),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    expect(responses.map(({ body: order }) => order.status)).toEqual(['FILLED', 'FILLED']);
  });

  test('returns contract errors and NOT_FOUND for invalid or unknown resources', async () => {
    const { user, instrument } = await createFixture();
    const base = {
      userId: user.id,
      instrumentId: instrument.id,
      side: 'BUY',
      type: 'MARKET',
      size: 1,
    };

    const invalid = await submit({ ...base, price: 20 }).expect(400);
    expect(invalid.body.code).toBe('INVALID_REQUEST');
    expect(invalid.headers['x-request-id']).toBeDefined();
    expect(invalid.body.details).toEqual(expect.arrayContaining([
      expect.stringMatching(/^price:/),
    ]));
    expect(JSON.stringify(invalid.body)).not.toContain('20');
    const invalidSell = await submit({ ...base, side: 'SELL', price: 20 }).expect(400);
    expect(invalidSell.body.code).toBe('INVALID_REQUEST');

    const noUser = await submit({ ...base, userId: 999999 }).expect(404);
    expect(noUser.body.code).toBe('NOT_FOUND');

    const noInstrument = await submit({ ...base, instrumentId: 999999 }).expect(404);
    expect(noInstrument.body.code).toBe('NOT_FOUND');
  });

  test.each([
    ['zero size', { size: 0 }],
    ['negative size', { size: -1 }],
    ['non-integer size', { size: 1.5 }],
    ['nonpositive amount', { size: undefined, amount: 0 }],
    ['both size and amount', { amount: 10 }],
    ['neither size nor amount', { size: undefined }],
  ])('returns 400 INVALID_REQUEST for %s', async (_label, fields) => {
    const response = await submit({
      userId: 1,
      instrumentId: 1,
      side: 'BUY',
      type: 'MARKET',
      size: 1,
      ...fields,
    }).expect(400);

    expect(response.body.code).toBe('INVALID_REQUEST');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
