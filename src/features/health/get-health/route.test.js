import { describe, expect, test } from '@jest/globals';
import pino from 'pino';
import request from 'supertest';
import { createApp } from '../../../app.js';

const config = {
  port: 3000,
  databaseUrl: 'postgresql://unused:unused@127.0.0.1:5432/unused',
};

describe('GET /health error handling', () => {
  test('does not expose database diagnostics when the health check fails', async () => {
    const { app } = createApp(config, {
      healthReader: {
        ping: async () => {
          throw new Error('connection refused at secret-db.internal');
        },
      },
      logger: pino({ level: 'silent' }),
    });

    const response = await request(app).get('/health').expect(500);

    expect(response.body).toEqual({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
    expect(response.headers['x-request-id']).toBeDefined();
    expect(JSON.stringify(response.body)).not.toContain('secret-db.internal');
  });
});
