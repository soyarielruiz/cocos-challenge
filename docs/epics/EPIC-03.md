# EPIC-03 — Users can view their portfolio with derived positions and performance

## Business impact

Users can inspect their current account value, available cash, and investment
positions with quantity, market value, total performance, and daily change.
All values are derived at read time from orders and market data; no portfolio
state is materialized.

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

In a second terminal:

```sh
curl -i "http://localhost:3000/api/users/1/portfolio"
npm test test/integration/users-portfolio.test.js
npm run lint
```

## Expected output

The request returns HTTP 200 with an `X-Request-Id` header and a portfolio
object matching the OpenAPI contract. The response's `totalValue`,
`availableCash`, positions, and performance values match deterministic golden
values derived from the provided seed. The integration suite prints `PASS`
after verifying those values against Docker Compose PostgreSQL; `npm run lint`
passes.

## Definition of done

- Deliver `GET /api/users/:userId/portfolio` as specified by
  `docs/api/openapi.yaml`. An unknown user returns HTTP 404 with
  `NOT_FOUND`.
- Derive cash and positions from `FILLED` orders, with cash represented by the
  `MONEDA` instrument. Do not materialize portfolio or position state.
- Obtain each position's latest price through the market-data repository's
  `DISTINCT ON (instrument_id)` query. Keep raw SQL in repositories only.
- Calculate position performance using volume-weighted average buy price
  against the latest `close`; calculate daily change from `close` and
  `previousClose`. Return `performancePct: null` for positions with
  `quantity <= 0`, and preserve legacy negative quantities from the seed.
- Keep the endpoint in the `route.js` / `schema.js` / `execute.js` structure,
  with persistence behind injected ports. Unit tests use in-memory fakes;
  integration tests use real Prisma.
- Error responses use only the ADR-0012 taxonomy mirrored by the OpenAPI
  `Error` schema: `INVALID_REQUEST`, `NOT_FOUND`, `ORDER_NOT_CANCELLABLE`,
  `RESOURCE_CONFLICT`, or `INTERNAL_SERVER_ERROR`. Validation details name
  invalid fields, and responses never expose raw database errors or stack
  traces.
- Development and all routine tests use Docker Compose PostgreSQL via
  `DATABASE_LOCAL`, with deterministic seed data. Do not use Neon,
  `DATABASE_TEST`, or the challenge-provided database in this epic.
- The demo and expected output above are achievable from the repository root.

## Ordered sessions

### 1. Deliver the derived portfolio endpoint

- **TDD (red-first):** Add and run failing unit tests for `calculatePerformance`
  and the portfolio use case before implementation. Cover deterministic
  volume-weighted performance values, daily change, `quantity <= 0` returning
  null performance, derived cash and position aggregation, and the unknown
  user branch. Add and run failing real-Prisma integration tests against local
  Docker Compose PostgreSQL for the response's golden values, latest market
  data selection, FILLED-only aggregation, the legacy negative position, the
  404 error envelope, and the request-ID header.
- **Work:** Implement the portfolio endpoint with injected ports and
  repository-owned aggregation/latest-price queries. Match the OpenAPI
  response and error schemas; do not add persistence for derived portfolio
  values.
- **Verify:** Start local PostgreSQL and load the deterministic seed with
  `npm run db:local:up && npm run db:validate && npm run db:migrate &&
  npm run db:seed`, using `DATABASE_LOCAL`. Run
  `npm test test/integration/users-portfolio.test.js` and `npm run lint`.
  Start the API with `npm start`, then run
  `curl -i "http://localhost:3000/api/users/1/portfolio"`. Confirm HTTP 200,
  `X-Request-Id`, the OpenAPI response shape, and seed-derived golden values;
  confirm an unknown user returns 404 with `NOT_FOUND`. Stop the API with
  SIGINT and confirm graceful shutdown. Do not run Neon or challenge-database
  commands in this session.
- **Commit:** Commit this complete portfolio vertical slice separately.
- **Citations:** [ADR-0001](../adrs/ADR-0001-stack-express-javascript.md),
  [ADR-0002](../adrs/ADR-0002-estructura-features-y-strategy.md),
  [ADR-0003](../adrs/ADR-0003-schema-normalizado.md),
  [ADR-0004](../adrs/ADR-0004-posiciones-derivadas-de-orders.md),
  [ADR-0007](../adrs/ADR-0007-validacion-y-errores.md),
  [ADR-0008](../adrs/ADR-0008-estrategia-de-testing.md),
  [ADR-0010](../adrs/ADR-0010-three-stage-database-environment.md),
  [ADR-0011](../adrs/ADR-0011-graceful-shutdown.md),
  [ADR-0012](../adrs/ADR-0012-taxonomia-de-errores-y-mapeo-de-db.md),
  [ADR-0013](../adrs/ADR-0013-metodo-de-costo-de-venta.md).

### 2. Amend cash derivation per ADR-0014

- **TDD (red-first):** Add and run failing unit tests for amended cash
  derivation before changing the implementation. Cover cash additions from
  `CASH_IN` and deductions from `CASH_OUT` using their `MONEDA` order sizes;
  subtract `size × price` for FILLED security BUYs and add `size × price` for
  FILLED security SELLs. Verify `NEW`, `REJECTED`, and `CANCELLED` orders do
  not affect cash. Add and run failing real-Prisma integration tests against
  local Docker Compose PostgreSQL with golden values recomputed from the
  deterministic seed. Calculate security trade values using each order's own
  `price` column, never the market close.
- **Work:** Update only the portfolio use case's cash derivation per
  ADR-0014. Keep positions, performance, daily change, and the response shape
  unchanged.
- **Verify:** Start local PostgreSQL and load the deterministic seed with
  `npm run db:local:up && npm run db:validate && npm run db:migrate &&
  npm run db:seed`, using `DATABASE_LOCAL` only. Run
  `npm test test/integration/users-portfolio.test.js` and `npm run lint`.
  Start the API with `npm start`, then run
  `curl -i "http://localhost:3000/api/users/1/portfolio"`. Confirm the
  recomputed seed-derived cash golden value, unchanged positions/performance/
  daily-change values and response shape, and the expected request ID. Stop
  the API with SIGINT and confirm graceful shutdown. Do not run Neon or
  challenge-database commands in this session.
- **Commit:** Commit this cash-derivation amendment slice separately.
- **Citations:** [ADR-0001](../adrs/ADR-0001-stack-express-javascript.md),
  [ADR-0004](../adrs/ADR-0004-posiciones-derivadas-de-orders.md),
  [ADR-0008](../adrs/ADR-0008-estrategia-de-testing.md),
  [ADR-0010](../adrs/ADR-0010-three-stage-database-environment.md),
  [ADR-0011](../adrs/ADR-0011-graceful-shutdown.md),
  [ADR-0012](../adrs/ADR-0012-taxonomia-de-errores-y-mapeo-de-db.md),
  [ADR-0014](../adrs/ADR-0014-disponibilidad-pesos-por-operaciones.md).
