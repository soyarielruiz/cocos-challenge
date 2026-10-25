import 'dotenv/config';
import { resolveDatabaseUrl } from '../scripts/database-target.js';

const databaseUrl = resolveDatabaseUrl(process.env);

if (databaseUrl !== undefined) {
  process.env.DATABASE_LOCAL = databaseUrl;
}
