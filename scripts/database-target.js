/**
 * Selects the hosted test database when configured, otherwise the local database.
 *
 * @param {NodeJS.ProcessEnv} env - Environment variables containing database URLs.
 * @returns {string | undefined} The selected database URL, if configured.
 */
export function resolveDatabaseUrl(env) {
  return env.DATABASE_TEST ?? env.DATABASE_LOCAL;
}
