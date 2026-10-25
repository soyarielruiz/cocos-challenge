# EPIC-04 — Users can execute MARKET orders with atomic validation

## Business impact

Users can buy or sell at the latest market price while the system prevents
concurrent orders for the same user from spending the same cash or selling the
same positions twice. Rejected orders remain persisted for auditability.

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
curl -i -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"instrumentId":1,"side":"BUY","type":"MARKET","size":10}'
curl -i -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"instrumentId":1,"side":"BUY","type":"MARKET","amount":999999999}'
npm test test/integration/orders-create-market.test.js
npm run lint
```

## Expected output

With the deterministic seed loaded, the first BUY returns HTTP 201 with a
persisted `FILLED` order. The second BUY returns HTTP 201 with a persisted
`REJECTED` order. Each response includes `X-Request-Id`; the integration suite
prints `PASS` after exercising the MARKET flows and the same-user concurrency
case against Docker Compose PostgreSQL. Lint passes.

## Definition of done

- Deliver `POST /api/orders` for `MARKET` orders, using the OpenAPI
  `OrderRequest`, `Order`, and `Error` schemas. MARKET fills at the latest
  `close` and rejects a supplied `price`. Do not implement LIMIT execution or
  cancellation in this epic; those remain in EPIC-05.
- Support `BUY`, `SELL`, `CASH_IN`, and `CASH_OUT` MARKET requests. `CASH_IN`
  and `CASH_OUT` use the `MONEDA` instrument and represent ARS units with
  integer `size`; `CASH_IN` fills, while insufficient cash for `CASH_OUT`
  creates a persisted `REJECTED` order. LIMIT cash requests are invalid.
- A request supplies exactly one of `size` or `amount`. For `amount`, calculate
  `size = floor(amount / reference price)` with decimal-safe monetary math and
  no fractional shares or rounding up. For `MARKET`, the reference price is
  latest `close` for securities; the `MONEDA` unit price is 1 ARS. `size = 0`
  is persisted as `REJECTED`. Insufficient cash for BUY/CASH_OUT and
  insufficient positions for SELL also persist `REJECTED` orders and return
  HTTP 201.
- Validate that the user and instrument exist before execution; unknown
  resources return HTTP 404 with `NOT_FOUND`. Contract errors, including a
  `price` on MARKET, LIMIT on cash, or invalid `size`/`amount` input, return
  HTTP 400 with `INVALID_REQUEST`. Validation details identify invalid
  fields, not submitted values.
- Own order creation in the use case's transaction. Acquire a per-user
  `pg_advisory_xact_lock`, then read derived cash/positions and insert the
  order and final status in that same transaction. Concurrent orders for one
  user cannot double-spend or over-sell; different users buying the same
  instrument do not contend for finite inventory.
- Use the ADR-0012 error mapping mirrored by the OpenAPI `Error` schema:
  `INVALID_REQUEST` (400), `NOT_FOUND` (404), `ORDER_NOT_CANCELLABLE` (409),
  `RESOURCE_CONFLICT` (409), and `INTERNAL_SERVER_ERROR` (500). Persistence
  uniqueness/FK conflicts map to `RESOURCE_CONFLICT`; `P2025` maps to
  `NOT_FOUND`; other persistence and unexpected errors return the generic
  internal error. Never expose SQL, database messages or metadata, or stack
  traces; log the original server-side error with pino and the request ID.
  Every response includes `X-Request-Id`.
- Follow the endpoint boundary: `route.js` handles HTTP only, `schema.js`
  parses the request with Zod, and `execute.js` owns the use case. Inject
  ports; keep Prisma and raw SQL out of the use case and route.
- Tests are red-first: unit tests use in-memory port fakes without Prisma;
  integration tests and the Supertest functional endpoint test use real
  Prisma against Docker Compose PostgreSQL via `DATABASE_LOCAL`, with
  deterministic seed data. Do not use Neon, `DATABASE_TEST`, or the
  challenge-provided database in any session in this epic.
- Keep at least 80% line coverage for the order use case, executors, and
  policies. The full order-lifecycle functional suite required by ADR-0008
  also covers LIMIT and cancellation when those features are delivered in
  EPIC-05.
- After a FILLED security BUY, derived cash decreases by size × fill price
  per ADR-0014 (and increases for SELL).
- BUY or SELL targeting the `MONEDA` instrument returns 400
  `INVALID_REQUEST`: cash movements use `CASH_IN`/`CASH_OUT` only.
- The demo and expected output above are achievable from the repository root.

## Ordered sessions

### 1. Deliver atomic MARKET BUY and cash-order flows

- **TDD (red-first):** Add and run failing unit tests before implementation
  for MARKET BUY with available cash, insufficient cash persisted as
  `REJECTED`, missing user/instrument, `price` supplied to MARKET, and
  `size`/`amount` XOR validation. Cover decimal-safe `amount` flooring and
  `size = 0` persisted as `REJECTED`. Cover `CASH_IN` as a filled integer ARS
  deposit and `CASH_OUT` as a cash-validated integer ARS withdrawal, including
  insufficient cash persisted as `REJECTED`; reject a non-`MONEDA` instrument
  or LIMIT cash request as `INVALID_REQUEST`. Use in-memory fakes for the
  use-case and executor tests. Add and run failing real-Prisma integration
  tests against local Docker Compose PostgreSQL for persisted order fields,
  status, and derived cash after each cash-side operation. Add a same-user
  concurrent BUY integration case whose combined cost exceeds available cash;
  verify serialization prevents total filled spend from exceeding the
  starting cash.
- **Work:** Implement the `POST /api/orders` route, strict Zod contract, order
  creation use case, `MARKET` strategy executor, and injected persistence and
  transaction ports needed for BUY and cash operations. Within the user's
  transaction, acquire the per-user advisory lock before reading cash and
  inserting the order. Resolve security prices from latest market data in the
  market-data repository; cash units use the `MONEDA` convention.
- **Verify:** Start and seed local PostgreSQL with
  `npm run db:local:up && npm run db:validate && npm run db:migrate &&
  npm run db:seed`, using `DATABASE_LOCAL`. Run the new unit tests and
  `npm test test/integration/orders-create-market.test.js`. Confirm BUY with
  funds returns 201 `FILLED`, insufficient cash and zero-size attempts return
  201 `REJECTED` with persisted orders, cash deposits/withdrawals follow the
  OpenAPI contract, the concurrent BUY case does not double-spend, invalid
  requests return 400 `INVALID_REQUEST`, and unknown resources return 404
  `NOT_FOUND`. Do not run Neon or challenge-database commands.
- **Commit:** Commit this atomic BUY and cash-order vertical slice separately.
- **Citations:** [ADR-0001](../adrs/ADR-0001-stack-express-javascript.md),
  [ADR-0002](../adrs/ADR-0002-estructura-features-y-strategy.md),
  [ADR-0004](../adrs/ADR-0004-posiciones-derivadas-de-orders.md),
  [ADR-0005](../adrs/ADR-0005-semantica-de-ordenes.md),
  [ADR-0006](../adrs/ADR-0006-cantidad-vs-monto.md),
  [ADR-0007](../adrs/ADR-0007-validacion-y-errores.md),
  [ADR-0008](../adrs/ADR-0008-estrategia-de-testing.md),
  [ADR-0009](../adrs/ADR-0009-concurrencia-y-atomicidad.md),
  [ADR-0010](../adrs/ADR-0010-three-stage-database-environment.md),
  [ADR-0012](../adrs/ADR-0012-taxonomia-de-errores-y-mapeo-de-db.md).

### 2. Deliver atomic MARKET SELL and complete the MARKET contract

- **TDD (red-first):** Add and run failing unit tests before implementation
  for MARKET SELL with enough positions, insufficient positions persisted as
  `REJECTED`, and the use-case branches for final order status. Add failing
  concurrency integration tests using real Prisma and the local database:
  same-user SELL requests whose combined size exceeds available positions
  must serialize so total filled sales never exceed the starting position.
  Verify different users buying the same instrument can both fill. Add red-first
  Supertest contract coverage for all MARKET request branches and ADR-0012
  status/code mappings, including generic internal errors without database
  details or stack traces.
- **Work:** Complete the SELL validation and order persistence path using the
  existing transaction and executor structure. Keep position and cash
  calculations derived from FILLED orders. Confirm the error middleware
  maps typed and Prisma/pg errors to the stable taxonomy and logs unexpected
  errors with the request ID.
- **Verify:** Using only `DATABASE_LOCAL` and local Docker Compose PostgreSQL,
  run `npm run db:local:up && npm run db:validate && npm run db:migrate &&
  npm run db:seed`, the order unit tests,
  `npm test test/integration/orders-create-market.test.js`,
  `npm run lint`, and the complete executable demo. Confirm SELL with
  positions returns 201 `FILLED`, insufficient positions returns 201
  `REJECTED` and persists, concurrent BUY/SELL requests preserve the
  per-user balances, errors use only the documented ADR-0012 codes and
  status mappings, and every response has `X-Request-Id`. No Neon or
  challenge-database work is part of this session.
- **Commit:** Commit this MARKET SELL and contract-completion vertical slice
  separately.
- **Citations:** [ADR-0001](../adrs/ADR-0001-stack-express-javascript.md),
  [ADR-0002](../adrs/ADR-0002-estructura-features-y-strategy.md),
  [ADR-0004](../adrs/ADR-0004-posiciones-derivadas-de-orders.md),
  [ADR-0005](../adrs/ADR-0005-semantica-de-ordenes.md),
  [ADR-0006](../adrs/ADR-0006-cantidad-vs-monto.md),
  [ADR-0007](../adrs/ADR-0007-validacion-y-errores.md),
  [ADR-0008](../adrs/ADR-0008-estrategia-de-testing.md),
  [ADR-0009](../adrs/ADR-0009-concurrencia-y-atomicidad.md),
  [ADR-0010](../adrs/ADR-0010-three-stage-database-environment.md),
  [ADR-0012](../adrs/ADR-0012-taxonomia-de-errores-y-mapeo-de-db.md).
