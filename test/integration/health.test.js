import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import 'dotenv/config';
import request from 'supertest';
import { createApp } from '../../src/app.js';

const healthTestTarget = process.env.HEALTH_TEST_TARGET ?? 'local';
const databaseUrl = healthTestTarget === 'neon'
  ? process.env.DATABASE_TEST
  : process.env.DATABASE_LOCAL;

if (!databaseUrl) {
  throw new Error(
    healthTestTarget === 'neon'
      ? 'DATABASE_TEST must point to an isolated Neon test branch.'
      : 'DATABASE_LOCAL must point to the local development database.',
  );
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
