import { z } from 'zod';

/**
 * @typedef {object} AppConfig
 * @property {number} port
 * @property {string} databaseUrl
 */

const configSchema = z.object({
  DATABASE_LOCAL: z
    .string()
    .url()
    .refine((value) => {
      const protocol = value.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
      return protocol === 'postgres' || protocol === 'postgresql';
    }, {
      message: 'must be a PostgreSQL connection URL',
    }),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
}).transform(({ DATABASE_LOCAL, PORT }) => ({
  databaseUrl: DATABASE_LOCAL,
  port: PORT,
}));

/**
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {AppConfig}
 */
export const parseConfig = (env = process.env) => {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
};
