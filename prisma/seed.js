import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const seedPath = new URL('../database.sql', import.meta.url);
const columnNames = new Map([
  ['accountnumber', 'account_number'],
  ['instrumentid', 'instrument_id'],
  ['userid', 'user_id'],
  ['datetime', 'created_at'],
  ['previousclose', 'previous_close'],
]);

function normalizeColumnNames(statement) {
  return statement.replace(/\(([^()]*)\)(\s+VALUES)/i, (match, columns, values) => {
    const normalized = columns
      .replace(/"date"/gi, 'market_date')
      .replace(/\b(accountnumber|instrumentid|userid|datetime|previousclose)\b/gi, (column) =>
        columnNames.get(column.toLowerCase()),
      );

    return `(${normalized})${values}`;
  });
}

try {
  if (!process.env.DATABASE_TEST) {
    throw new Error('DATABASE_TEST must point to an isolated test database.');
  }

  const source = await readFile(seedPath, 'utf8');
  const inserts = [...source.matchAll(/\bINSERT\s+INTO\b[\s\S]*?;/gi)].map(([statement]) =>
    normalizeColumnNames(statement),
  );

  if (inserts.length === 0) {
    throw new Error('The provided database.sql does not contain seed INSERT statements.');
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(
      'TRUNCATE TABLE orders, marketdata, instruments, users RESTART IDENTITY CASCADE',
    );

    for (const statement of inserts) {
      await transaction.$executeRawUnsafe(statement);
    }
  }, { maxWait: 10_000, timeout: 120_000 });
} finally {
  await prisma.$disconnect();
}
