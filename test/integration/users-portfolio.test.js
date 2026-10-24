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

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/users/:userId/portfolio', () => {
  test('returns seed-derived values using only filled orders and each latest market price', async () => {
    const response = await request(app)
      .get('/api/users/1/portfolio')
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body.userId).toBe(1);
    expect(response.body.availableCash).toBe(900000);
    expect(response.body.totalValue).toBe(1036756);
    expect(response.body.positions).toHaveLength(3);
    expect(response.body.positions.map(({ ticker }) => ticker)).toEqual([
      'BMA',
      'METR',
      'PAMP',
    ]);
    expect(response.body.positions).toEqual([
      {
        ticker: 'BMA',
        name: 'Banco Macro S.A.',
        quantity: -10,
        marketValue: -15028,
        performancePct: null,
        dailyChangePct: expect.closeTo(((1502.8 - 1520.25) / 1520.25) * 100),
      },
      {
        ticker: 'METR',
        name: 'MetroGAS S.A.',
        quantity: 500,
        marketValue: 114750,
        performancePct: expect.closeTo(((229.5 - 250) / 250) * 100),
        dailyChangePct: expect.closeTo(((229.5 - 232) / 232) * 100),
      },
      {
        ticker: 'PAMP',
        name: 'Pampa Holding S.A.',
        quantity: 40,
        marketValue: 37034,
        performancePct: expect.closeTo(((925.85 - 930) / 930) * 100),
        dailyChangePct: expect.closeTo(((925.85 - 921.8) / 921.8) * 100),
      },
    ]);
  });

  test('returns the contract 404 envelope and request ID for an unknown user', async () => {
    const response = await request(app)
      .get('/api/users/999999/portfolio')
      .expect(404);

    expect(response.body).toEqual({
      code: 'NOT_FOUND',
      message: 'User not found',
    });
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('rejects an invalid user ID with INVALID_REQUEST and a request ID', async () => {
    const response = await request(app)
      .get('/api/users/not-an-integer/portfolio')
      .expect(400);

    expect(response.body.code).toBe('INVALID_REQUEST');
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.stringMatching(/^userId:/)]),
    );
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
