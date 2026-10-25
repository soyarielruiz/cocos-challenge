import { describe, expect, test } from '@jest/globals';
import { resolveDatabaseUrl } from '../../scripts/database-target.js';

describe('resolveDatabaseUrl', () => {
  test('prefers DATABASE_TEST when it is set', () => {
    expect(resolveDatabaseUrl({
      DATABASE_TEST: 'postgresql://hosted.test/database',
      DATABASE_LOCAL: 'postgresql://localhost/database',
    })).toBe('postgresql://hosted.test/database');
  });

  test('falls back to DATABASE_LOCAL when DATABASE_TEST is unset', () => {
    expect(resolveDatabaseUrl({
      DATABASE_LOCAL: 'postgresql://localhost/database',
    })).toBe('postgresql://localhost/database');
  });

  test('returns undefined when neither database target is configured', () => {
    expect(resolveDatabaseUrl({})).toBeUndefined();
  });
});
