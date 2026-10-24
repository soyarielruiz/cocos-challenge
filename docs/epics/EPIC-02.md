# EPIC-02 — Users can search for instruments by ticker or name

## Business impact

Investors can quickly find available assets by ticker or name, with exact ticker
matches ordered before other matches.

## Executable demo

From the repository root, with `.env` configured so `DATABASE_LOCAL` points to
the local Docker Compose PostgreSQL database:

```sh
npm run db:local:up && npm run db:validate && npm run db:migrate && npm run db:seed
```

In one terminal, start the API:

```sh
npm start
```

In a second terminal, run the endpoint and its real-database integration suite:

```sh
curl -i "http://localhost:3000/api/instruments?search=banco"
npm test test/integration/instruments-search.test.js
npm run lint
```

## Expected output

The search request returns HTTP 200 with an `X-Request-Id` header and a JSON
array of instruments matching `banco` in ticker or name (for example, BBAR,
BHIP, BMA, and BPAT by name in the provided seed). An exact ticker match,
when present, appears first. The integration suite prints `PASS` after running
against the seeded Docker Compose PostgreSQL database, and lint passes.

## Definition of done

- Deliver `GET /api/instruments?search=<term>` as specified by the OpenAPI
  contract. Search ticker and name with database-level `ILIKE`; order exact
  ticker matches first. Do not add full-text or trigram indexes.
- Missing or empty `search` returns HTTP 400 with the standard safe error
  envelope and `INVALID_REQUEST`; Zod reports all detected validation errors,
  with invalid field names rather than submitted values.
- Keep HTTP wiring, request schema, and use-case logic in the endpoint's
  `route.js`, `schema.js`, and `execute.js` boundary. Persistence stays behind
  injected ports; unit tests use in-memory fakes and integration tests use real
  Prisma.
- Development and all tests for this epic use Docker Compose PostgreSQL via
  `DATABASE_LOCAL`, with deterministic seed data. No Neon or challenge-provided
  database work is scheduled in this epic. Hosted integration validation
  remains a separate later stage under ADR-0010.
- The demo and expected output above are achievable from the repository root.

## Ordered sessions

### 1. Deliver instrument search by ticker or name

- **TDD (red-first):** Add and run failing use-case tests with an in-memory
  instrument-search port fake. Cover forwarding the parsed search term and
  returning the port's matching results. Add and run failing real-Prisma
  integration tests against local Docker Compose PostgreSQL for `ILIKE`
  matching on both ticker and name, exact ticker-first ordering, and the HTTP
  validation branches for missing and empty `search`.
- **Work:** Implement the search endpoint using the established
  route/schema/execute structure and an injected persistence port. Keep the
  `ILIKE` predicate and exact-ticker-first ordering in the database query; do
  not add a full-text or trigram index.
- **Verify:** Start the local database with `npm run db:local:up`, apply
  migrations and deterministic seed data with `npm run db:validate &&
  npm run db:migrate && npm run db:seed`, then run
  `npm test test/integration/instruments-search.test.js` and `npm run lint`
  using `DATABASE_LOCAL`. Start the API with `npm start` and run
  `curl -i "http://localhost:3000/api/instruments?search=app"`. Confirm HTTP
  200, the request-ID header, matching ticker/name results, and exact ticker
  first when present; confirm missing and empty `search` return 400 with
  `INVALID_REQUEST`. Stop the API with SIGINT and confirm graceful shutdown.
  Do not run Neon or challenge-database commands in this session.
- **Commit:** Commit this complete instrument-search vertical slice separately.
- **Citations:** [ADR-0001](../adrs/ADR-0001-stack-express-javascript.md),
  [ADR-0002](../adrs/ADR-0002-estructura-features-y-strategy.md),
  [ADR-0003](../adrs/ADR-0003-schema-normalizado.md),
  [ADR-0007](../adrs/ADR-0007-validacion-y-errores.md),
  [ADR-0008](../adrs/ADR-0008-estrategia-de-testing.md),
  [ADR-0010](../adrs/ADR-0010-three-stage-database-environment.md),
  [ADR-0011](../adrs/ADR-0011-graceful-shutdown.md),
  [ADR-0012](../adrs/ADR-0012-taxonomia-de-errores-y-mapeo-de-db.md).
