import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  if (!process.env.DATABASE_LOCAL) {
    throw new Error('DATABASE_LOCAL must point to the local development database.');
  }
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('normalized database contract', () => {
  test('uses the required table and snake_case column names', async () => {
    const columns = await prisma.$queryRaw`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN ('users', 'instruments', 'orders', 'marketdata')
      ORDER BY table_name, ordinal_position
    `;

    const actual = Object.fromEntries(
      ['users', 'instruments', 'orders', 'marketdata'].map((table) => [
        table,
        columns.filter((column) => column.table_name === table).map((column) => column.column_name),
      ]),
    );

    expect(actual).toEqual({
      users: ['id', 'email', 'account_number'],
      instruments: ['id', 'ticker', 'name', 'type'],
      orders: ['id', 'instrument_id', 'user_id', 'size', 'price', 'type', 'side', 'status', 'created_at'],
      marketdata: ['id', 'instrument_id', 'high', 'low', 'open', 'close', 'previous_close', 'market_date'],
    });
  });

  test('stores monetary columns as NUMERIC(18,2)', async () => {
    const monetaryColumns = await prisma.$queryRaw`
      SELECT table_name, column_name, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND data_type = 'numeric'
      ORDER BY table_name, column_name
    `;

    expect(monetaryColumns.length).toBeGreaterThan(0);
    expect(
      monetaryColumns.every(
        (column) => Number(column.numeric_precision) === 18 && Number(column.numeric_scale) === 2,
      ),
    ).toBe(true);
    expect(monetaryColumns.map((column) => `${column.table_name}.${column.column_name}`).sort()).toEqual([
      'marketdata.close',
      'marketdata.high',
      'marketdata.low',
      'marketdata.open',
      'marketdata.previous_close',
      'orders.price',
    ]);
  });

  test('marks required business columns as NOT NULL', async () => {
    const columns = await prisma.$queryRaw`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND is_nullable = 'NO'
        AND (
          (table_name = 'users' AND column_name IN ('email', 'account_number'))
          OR (table_name = 'instruments' AND column_name IN ('ticker', 'name', 'type'))
          OR (table_name = 'orders' AND column_name IN (
            'instrument_id', 'user_id', 'size', 'price', 'type', 'side', 'status', 'created_at'
          ))
          OR (table_name = 'marketdata' AND column_name IN (
            'instrument_id', 'close', 'previous_close', 'market_date'
          ))
        )
      ORDER BY table_name, column_name
    `;
    const actual = columns.map((column) => `${column.table_name}.${column.column_name}`);

    expect(actual).toEqual([
      'instruments.name',
      'instruments.ticker',
      'instruments.type',
      'marketdata.close',
      'marketdata.instrument_id',
      'marketdata.market_date',
      'marketdata.previous_close',
      'orders.created_at',
      'orders.instrument_id',
      'orders.price',
      'orders.side',
      'orders.size',
      'orders.status',
      'orders.type',
      'orders.user_id',
      'users.account_number',
      'users.email',
    ]);
  });

  test('restricts deletion through all required foreign keys', async () => {
    const foreignKeys = await prisma.$queryRaw`
      SELECT conrelid::regclass::text AS table_name, confdeltype AS on_delete
      FROM pg_constraint
      WHERE contype = 'f'
        AND conrelid::regclass::text IN ('orders', 'marketdata')
    `;

    expect(foreignKeys).toHaveLength(3);
    expect(foreignKeys.every((constraint) => constraint.on_delete === 'r')).toBe(true);
  });

  test('enforces the required domain checks', async () => {
    const checks = await prisma.$queryRaw`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE contype = 'c'
        AND conrelid::regclass::text IN ('orders', 'marketdata')
    `;
    const definitions = checks.map((constraint) => constraint.definition.toLowerCase());

    expect(definitions.some((definition) => definition.includes('size > 0'))).toBe(true);
    expect(definitions.some((definition) => /price\s*>\s*\(0\)::numeric/.test(definition))).toBe(true);
    expect(
      definitions.some(
        (definition) =>
          definition.includes('side') &&
          ['buy', 'sell', 'cash_in', 'cash_out'].every((side) => definition.includes(`'${side}'`)),
      ),
    ).toBe(true);
    expect(
      definitions.some(
        (definition) =>
          definition.includes('type') &&
          ['market', 'limit'].every((type) => definition.includes(`'${type}'`)),
      ),
    ).toBe(true);
    expect(
      definitions.some(
        (definition) =>
          definition.includes('status') &&
          ['new', 'filled', 'rejected', 'cancelled'].every((status) => definition.includes(`'${status}'`)),
      ),
    ).toBe(true);
  });

  test('has required unique and performance indexes', async () => {
    const indexes = await prisma.$queryRaw`
      SELECT tablename, indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename IN ('users', 'instruments', 'orders', 'marketdata')
    `;
    const definitions = indexes.map((index) => index.indexdef.toLowerCase());

    expect(definitions.some((definition) => definition.includes('unique') && definition.includes('(email)'))).toBe(true);
    expect(definitions.some((definition) => definition.includes('unique') && definition.includes('(ticker)'))).toBe(true);
    expect(
      definitions.some(
        (definition) => definition.includes('unique') && definition.includes('(instrument_id, market_date)'),
      ),
    ).toBe(true);
    expect(
      definitions.some(
        (definition) =>
          definition.includes('orders') &&
          definition.includes('(user_id, instrument_id)') &&
          definition.includes('where') &&
          definition.includes('status') &&
          definition.includes("'filled'"),
      ),
    ).toBe(true);
    expect(
      definitions.some(
        (definition) =>
          definition.includes('marketdata') && definition.includes('(instrument_id, market_date desc)'),
      ),
    ).toBe(true);
  });

  test('reloads the provided seed data without correcting its legacy BMA position', async () => {
    const counts = await prisma.$queryRaw`
      SELECT
        (SELECT count(*) FROM users) AS users,
        (SELECT count(*) FROM instruments) AS instruments,
        (SELECT count(*) FROM orders) AS orders,
        (SELECT count(*) FROM marketdata) AS marketdata
    `;
    const positions = await prisma.$queryRaw`
      SELECT sum(CASE side WHEN 'BUY' THEN size WHEN 'SELL' THEN -size ELSE 0 END) AS net_size
      FROM orders
      WHERE user_id = 1
        AND instrument_id = (SELECT id FROM instruments WHERE ticker = 'BMA')
        AND status = 'FILLED'
    `;

    expect(Object.fromEntries(Object.entries(counts[0]).map(([key, value]) => [key, String(value)]))).toEqual({
      users: '4',
      instruments: '66',
      orders: '11',
      marketdata: '126',
    });
    expect(positions[0].net_size).toBe(-10n);
  });
});
