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

const searchFixtures = [
  { ticker: 'MATCH', name: 'Exact ticker fixture', type: 'ACCIONES' },
  { ticker: 'XMATCH', name: 'Other ticker fixture', type: 'ACCIONES' },
  { ticker: 'NAMEFIX', name: 'MATCH name fixture', type: 'ACCIONES' },
];

beforeAll(async () => {
  await prisma.$connect();
  await prisma.instrument.createMany({
    data: searchFixtures,
    skipDuplicates: true,
  });
});

afterAll(async () => {
  await prisma.instrument.deleteMany({
    where: { ticker: { in: searchFixtures.map(({ ticker }) => ticker) } },
  });
  await prisma.$disconnect();
});

describe('GET /api/instruments', () => {
  test('matches ticker and name with the exact ticker first', async () => {
    const response = await request(app)
      .get('/api/instruments')
      .query({ search: 'match' })
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body.map(({ ticker }) => ticker)).toEqual([
      'MATCH',
      'NAMEFIX',
      'XMATCH',
    ]);
  });

  test.each([
    ['missing', undefined],
    ['empty', ''],
  ])('rejects a %s search term with INVALID_REQUEST', async (_label, search) => {
    const requestBuilder = request(app).get('/api/instruments');
    const response = await (search === undefined
      ? requestBuilder
      : requestBuilder.query({ search })).expect(400);

    expect(response.body.code).toBe('INVALID_REQUEST');
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.stringMatching(/^search:/)]),
    );
    expect(response.headers['x-request-id']).toBeDefined();
  });
});
