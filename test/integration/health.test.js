import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import 'dotenv/config';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const databaseUrl = process.env.DATABASE_LOCAL;

if (!databaseUrl) {
  throw new Error('DATABASE_TEST or DATABASE_LOCAL must point to the test database.');
}

const { app, prisma } = createApp({
  databaseUrl,
  port: 3000,
});

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /health', () => {
  test('returns the contract response and request ID when the database is available', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
