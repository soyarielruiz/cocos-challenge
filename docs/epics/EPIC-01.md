# EPIC-01 — Operators can start and inspect a trustworthy API

## Business impact

Developers and operators can run the service, distinguish healthy from unavailable database-backed operation, validate environment configuration fail-fast, and inspect the contract without exposing internal diagnostics.

## Executable demo

From the repository root:

```sh
npm ci && npm run db:migrate && npm run db:seed && npm start
```

In a second terminal:

```sh
curl -i http://localhost:3000/health && npm test test/integration/health.test.js && npm run lint
```

## Expected output

`/health` returns HTTP 200, `{"status":"ok"}`, and an `X-Request-Id` header. The health integration test passes against the real PostgreSQL database. `npm run lint` passes, including the `eslint-plugin-jsdoc` rules.

## Definition of done

- Application startup reads configuration once through a Zod schema, reports all detected configuration errors, fails before serving if configuration is invalid, and defaults only `PORT`.
- The normalized Prisma schema is delivered through migrations, with `ON DELETE RESTRICT` foreign keys, domain CHECK constraints, `NUMERIC(18,2)` for money, and the agreed unique constraints and performance indexes. The provided seed is reloaded as-is.
- Request IDs are returned in `X-Request-Id` on every response. One global error handler returns safe `{ code, message, details? }` envelopes, translates Prisma/pg errors, and does not expose stack traces or raw database errors.
- The database-backed `/health` endpoint executes `SELECT 1` and returns the contract response when the database is operational, without exposing diagnostics.
- Graceful shutdown is implemented.
- Red-first tests cover configuration validation and the database-backed health check. Integration tests use real Prisma against the isolated test Neon branch, never the development database.
- The executable demo and expected output above are achievable from the repository root.

## Ordered sessions

### 1. Normalize the database schema and reload the provided seed

- **TDD (red-first):** Add and run failing database contract checks against local Docker Compose PostgreSQL before changing the schema. Cover the required naming, foreign-key behavior, domain constraints, money precision, uniqueness, and performance indexes.
- **Work:** Create the initial Prisma migration as the schema source of truth, preserving the specified schema invariants. Add or update the seed flow to reload the provided data as-is.
- **Verify:** Start local Docker Compose PostgreSQL pinned to `postgres:18` with ephemeral storage, then run `npm run db:migrate && npm run db:seed && npm run test:db` using `DATABASE_LOCAL`. Validate against an isolated Neon branch once endpoint flows are functional; migrate and seed the provided database only at delivery. If a local development database already contains the provided legacy schema, run `npm run db:baseline` once to normalize it and record the initial migration; on a fresh local database, run `npm run db:migrate` directly. Confirm seed data was not corrected or otherwise changed.
- **Commit:** Commit this schema-and-seed slice separately.
- **Citations:** [ADR-0001](../adrs/ADR-0001-stack-express-javascript.md), [ADR-0003](../adrs/ADR-0003-schema-normalizado.md), [ADR-0008](../adrs/ADR-0008-estrategia-de-testing.md).

### 2. Add fail-fast configuration, application startup, and graceful shutdown

- **TDD (red-first):** Add and run failing configuration contract tests first. Cover valid configuration, multiple reported invalid values, failure before serving, and the rule that only `PORT` has a default.
- **Work:** Parse environment configuration once at startup using the agreed Zod schema; compose the application dependencies at the application composition root; add graceful shutdown.
- **Verify:** Run the configuration tests and the applicable application-startup/shutdown tests. Confirm invalid configuration prevents the server from serving and reports all detected errors.
- **Commit:** Commit this startup-and-lifecycle slice separately.
- **Citations:** [ADR-0001](../adrs/ADR-0001-stack-express-javascript.md), [ADR-0002](../adrs/ADR-0002-estructura-features-y-strategy.md), [ADR-0008](../adrs/ADR-0008-estrategia-de-testing.md).

### 3. Add request IDs and safe global error handling

- **TDD (red-first):** Add and run failing tests first for request IDs on success and error responses, typed-error status/envelope mapping, Prisma/pg error translation, and absence of stack traces or raw database errors in client responses.
- **Work:** Add request-ID handling and pino correlation, then register one global error handler after the routes with the agreed safe error mapping.
- **Verify:** Run the request-ID and error-handler tests. Confirm `X-Request-Id` is present on every response path covered by the tests and that server-side errors are logged without exposing database diagnostics to clients.
- **Commit:** Commit this request-tracing-and-error-boundary slice separately.
- **Citations:** [ADR-0001](../adrs/ADR-0001-stack-express-javascript.md), [ADR-0007](../adrs/ADR-0007-validacion-y-errores.md), [ADR-0008](../adrs/ADR-0008-estrategia-de-testing.md).

### 4. Deliver the database-backed health endpoint and epic gates

- **TDD (red-first):** Add and run the failing health integration test before implementing the endpoint. Exercise it against real Prisma and the isolated test Neon branch; verify the successful response body, status, and request-ID header, and that database failures do not expose diagnostics.
- **Work:** Implement `GET /health` with `SELECT 1`, then confirm its response matches the OpenAPI contract. Run the epic's lint and integration gates.
- **Verify:** Run `npm test test/integration/health.test.js`, `npm run lint`, and the complete executable demo. Confirm the database is available for the passing health case and the response is exactly `{"status":"ok"}` with HTTP 200 and `X-Request-Id`.
- **Commit:** Commit the health endpoint and final EPIC-01 gate changes separately.
- **Citations:** [ADR-0007](../adrs/ADR-0007-validacion-y-errores.md), [ADR-0008](../adrs/ADR-0008-estrategia-de-testing.md).
