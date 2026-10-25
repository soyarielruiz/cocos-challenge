import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveDatabaseUrl } from './database-target.js';

const databaseUrl = resolveDatabaseUrl(process.env);

if (!databaseUrl) {
  throw new Error('Set DATABASE_TEST or DATABASE_LOCAL to a non-empty database URL.');
}

process.env.DATABASE_LOCAL = databaseUrl;

const prismaCliPath = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url));
const result = spawnSync(process.execPath, [prismaCliPath, ...process.argv.slice(2)], {
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
