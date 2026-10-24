import { describe, expect, test } from '@jest/globals';
import { ZodError } from 'zod';
import { parseConfig } from '../../src/config.js';

const databaseUrl = 'postgresql://postgres:postgres@localhost:5432/cocos_challenge?schema=public';

describe('parseConfig', () => {
  test('parses the database URL and configured port', () => {
    expect(parseConfig({ DATABASE_LOCAL: databaseUrl, PORT: '4100' })).toEqual({
      databaseUrl,
      port: 4100,
    });
  });

  test('defaults PORT while requiring DATABASE_LOCAL', () => {
    expect(parseConfig({ DATABASE_LOCAL: databaseUrl })).toEqual({
      databaseUrl,
      port: 3000,
    });

    try {
      parseConfig({});
      throw new Error('Expected missing DATABASE_LOCAL to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      expect(error.issues.map((issue) => issue.path[0])).toContain('DATABASE_LOCAL');
    }
  });

  test('reports multiple invalid configuration values together', () => {
    try {
      parseConfig({ DATABASE_LOCAL: 'not-a-url', PORT: 'not-a-port' });
      throw new Error('Expected invalid configuration to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      expect(error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['DATABASE_LOCAL', 'PORT']),
      );
    }
  });
});
