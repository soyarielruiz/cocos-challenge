import { Writable } from 'node:stream';
import { describe, expect, test } from '@jest/globals';
import pino from 'pino';
import request from 'supertest';
import { z } from 'zod';
import { createApp } from '../../src/app.js';
import {
  InvalidRequestError,
  NotFoundError,
  OrderNotCancellableError,
  ResourceConflictError,
} from '../../src/shared/errors.js';

const config = {
  port: 3000,
  databaseUrl: 'postgresql://user:pass@localhost:5432/db?schema=public',
};

const buildApp = (registerRoutes) => {
  const lines = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  const { app, prisma } = createApp(config, { registerRoutes, logger: pino(stream) });
  return { app, prisma, lines };
};

const failWith = (error) => (app) => {
  app.get('/boom', (_req, _res, next) => next(error));
};

const prismaError = (code, meta) =>
  Object.assign(new Error(`Invalid \`prisma.order.create()\` invocation: secret SQL detail ${code}`), {
    name: 'PrismaClientKnownRequestError',
    code,
    meta,
    stack: 'STACK_SECRET at /srv/app/db.js',
  });

describe('request id', () => {
  test('is present on successful responses', async () => {
    const { app } = buildApp((a) => a.get('/ok', (_req, res) => res.json({ ok: true })));
    const response = await request(app).get('/ok').expect(200);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('is unique per request', async () => {
    const { app } = buildApp((a) => a.get('/ok', (_req, res) => res.json({})));
    const first = await request(app).get('/ok');
    const second = await request(app).get('/ok');
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });

  test('is present on unknown routes, typed errors and unexpected errors', async () => {
    const { app } = buildApp(failWith(new Error('kaboom')));
    for (const path of ['/missing', '/boom']) {
      const response = await request(app).get(path);
      expect(response.headers['x-request-id']).toBeDefined();
    }
  });
});

describe('typed error mapping', () => {
  test.each([
    [new InvalidRequestError(['size: required']), 400, 'INVALID_REQUEST', ['size: required']],
    [new NotFoundError(), 404, 'NOT_FOUND', undefined],
    [new OrderNotCancellableError(), 409, 'ORDER_NOT_CANCELLABLE', undefined],
    [new ResourceConflictError(), 409, 'RESOURCE_CONFLICT', undefined],
  ])('maps %p', async (error, status, code, details) => {
    const { app } = buildApp(failWith(error));
    const response = await request(app).get('/boom').expect(status);
    expect(response.body.code).toBe(code);
    expect(typeof response.body.message).toBe('string');
    expect(response.body.details).toEqual(details);
    expect(Object.keys(response.body).sort()).toEqual(
      details ? ['code', 'details', 'message'] : ['code', 'message'],
    );
  });

  test('maps ZodError to INVALID_REQUEST listing every issue without submitted values', async () => {
    const parsed = z
      .object({ size: z.number(), side: z.enum(['BUY', 'SELL']) })
      .safeParse({ size: 'TOPSECRET', side: 'TOPSECRET2' });
    const { app } = buildApp(failWith(parsed.error));
    const response = await request(app).get('/boom').expect(400);
    expect(response.body.code).toBe('INVALID_REQUEST');
    expect(response.body.details).toHaveLength(2);
    expect(JSON.stringify(response.body)).not.toContain('TOPSECRET');
  });

  test('maps malformed JSON bodies to INVALID_REQUEST', async () => {
    const { app } = buildApp((a) => a.post('/echo', (req, res) => res.json(req.body)));
    const response = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"bad":')
      .expect(400);
    expect(response.body.code).toBe('INVALID_REQUEST');
    expect(response.headers['x-request-id']).toBeDefined();
  });

  test('maps unknown routes to NOT_FOUND', async () => {
    const { app } = buildApp(() => {});
    const response = await request(app).get('/nope').expect(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});

describe('persistence error translation', () => {
  test.each([
    [prismaError('P2002', { target: ['users_email_key'] }), 409, 'RESOURCE_CONFLICT'],
    [prismaError('P2003', { field_name: 'orders_user_id_fkey' }), 409, 'RESOURCE_CONFLICT'],
    [prismaError('P2025'), 404, 'NOT_FOUND'],
    [Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }), 409, 'RESOURCE_CONFLICT'],
    [Object.assign(new Error('violates foreign key constraint'), { code: '23503' }), 409, 'RESOURCE_CONFLICT'],
    [prismaError('P2010', { code: '23505', message: 'raw detail' }), 409, 'RESOURCE_CONFLICT'],
    [prismaError('P2034'), 500, 'INTERNAL_SERVER_ERROR'],
    [Object.assign(new Error('connection refused 10.0.0.5:5432'), { code: 'ECONNREFUSED' }), 500, 'INTERNAL_SERVER_ERROR'],
    [new Error('plain failure'), 500, 'INTERNAL_SERVER_ERROR'],
  ])('translates %p', async (error, status, code) => {
    const { app } = buildApp(failWith(error));
    const response = await request(app).get('/boom').expect(status);
    expect(response.body.code).toBe(code);
    expect(Object.keys(response.body).sort()).toEqual(['code', 'message']);
    const raw = JSON.stringify(response.body);
    for (const leak of ['SQL', 'prisma', 'users_email_key', 'orders_user_id_fkey', 'STACK_SECRET', '10.0.0.5', 'raw detail', 'duplicate key', 'foreign key', 'plain failure']) {
      expect(raw).not.toContain(leak);
    }
  });
});

describe('server-side logging', () => {
  test('logs the original error with the request id for 500 responses', async () => {
    const { app, lines } = buildApp(failWith(prismaError('P2034')));
    const response = await request(app).get('/boom').expect(500);
    const entry = lines.find((line) => line.err);
    expect(entry.reqId).toBe(response.headers['x-request-id']);
    expect(entry.err.message).toContain('secret SQL detail');
  });

  test('logs unexpected database errors reaching the boundary, such as FK violations, with the request id', async () => {
    const { app, lines } = buildApp(failWith(prismaError('P2003')));
    const response = await request(app).get('/boom').expect(409);
    const entry = lines.find((line) => line.err);
    expect(entry.reqId).toBe(response.headers['x-request-id']);
  });
});
