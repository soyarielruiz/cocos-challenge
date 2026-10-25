# EPIC-05 — Users can place LIMIT orders and cancel them safely

## Business impact

Users can submit orders at a chosen limit price and cancel an order while it
is still pending. Order state and ownership are enforced consistently, and
invalid cancellation attempts return safe, actionable errors.

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

In a second terminal, create a LIMIT order and cancel the returned order ID:

```sh
LIMIT_ORDER_ID=$(
  curl -fsS -X POST http://localhost:3000/api/orders \
    -H "Content-Type: application/json" \
    -d '{"userId":1,"instrumentId":1,"side":"BUY","type":"LIMIT","size":10,"price":100}' |
    node -e 'let body = ""; process.stdin.on("data", chunk => body += chunk).on("end", () => process.stdout.write(String(JSON.parse(body).id)));'
)
curl -i -X POST "http://localhost:3000/api/orders/$LIMIT_ORDER_ID/cancel" \
  -H "Content-Type: application/json" \
  -d '{"userId":1}'
npm test test/integration/orders-limit-cancel.test.js
npm run lint
```

## Expected output

The create request returns HTTP 201 with a persisted order in `NEW`. The
cancel request returns HTTP 200 with that order in `CANCELLED`; both responses
include `X-Request-Id`. The integration suite prints `PASS` against the
deterministically seeded Docker Compose PostgreSQL database, covering LIMIT
creation and cancellation ownership/state branches. Lint passes.

## Definition of done

- Deliver the LIMIT branch of `POST /api/orders` using the OpenAPI
  `OrderRequest`, `Order`, and `Error` schemas. A valid LIMIT order with a
  positive size and price is persisted as `NEW` at the requested price; do not
  add a matching engine or market simulation.
- Require a positive `price` for LIMIT and reject a missing or non-positive
  LIMIT price as HTTP 400 `INVALID_REQUEST`. Continue to reject `price` on
  MARKET. Accept exactly one of `size` or `amount`; when `amount` is supplied,
  calculate size with decimal-safe `floor(amount / limit price)`. If the
  calculated size is zero, persist the order as `REJECTED` and return HTTP
  201. A zero size is valid in persistence only for a `REJECTED` order.
- Keep cash and positions derived from orders, not materialized or reserved
  by this epic. `NEW`, `REJECTED`, and `CANCELLED` orders do not affect
  available cash; positions continue to derive from `FILLED` orders.
  `CASH_IN` and `CASH_OUT` remain MARKET-only and cannot be submitted as LIMIT.
- LIMIT orders do NOT validate cash or positions availability. They persist
  as `NEW` without reserving funds. Only `FILLED` orders affect derived
  cash/positions (ADR-0004, ADR-0005).
- Deliver `POST /api/orders/:id/cancel`. It cancels only a `NEW` order owned
  by the requesting `userId` and returns the persisted order as `CANCELLED`.
  A missing order or one owned by another user returns HTTP 404 `NOT_FOUND`
  with the same non-disclosing behavior. An order not in `NEW` returns HTTP
  409 `ORDER_NOT_CANCELLABLE`.
- Use only the ADR-0012 error taxonomy mirrored in the OpenAPI `Error`
  schema: `INVALID_REQUEST` (400), `NOT_FOUND` (404),
  `ORDER_NOT_CANCELLABLE` (409), `RESOURCE_CONFLICT` (409), and
  `INTERNAL_SERVER_ERROR` (500). Database uniqueness/FK conflicts map to
  `RESOURCE_CONFLICT`; `P2025` maps to `NOT_FOUND`; other persistence and
  unexpected errors return the generic internal error. Never expose database
  messages, SQL, metadata, or stack traces. Validation details name invalid
  fields, not submitted values.
- Include `X-Request-Id` on every response, including cancellation 404/409
  and internal errors, and log original server-side errors with pino and the
  request ID.
- Keep the endpoint boundary (`route.js`, `schema.js`, `execute.js`), injected
  ports, and Strategy Map for order types. Keep Prisma and raw SQL out of
  use cases and routes. Unit tests use in-memory port fakes; integration and
  functional tests use real Prisma.
- Development and all routine tests use Docker Compose PostgreSQL via
  `DATABASE_LOCAL`, with deterministic local seed data. No Neon validation or
  challenge-database work is scheduled in this epic.
- The functional order lifecycle suite covers MARKET BUY with funds →
  `FILLED`, MARKET BUY without funds → persisted `REJECTED`, LIMIT → `NEW`,
  SELL without positions → persisted `REJECTED`, cancel `NEW` →
  `CANCELLED`, cancel non-`NEW` → 409, and `amount` flooring including a
  calculated size of zero.
- The demo and expected output above are achievable from the repository root.

## Ordered sessions

### 1. Deliver LIMIT order creation

- **TDD (red-first):** Add and run failing unit tests before implementation
  for the LIMIT executor and create-order use case. Cover a valid LIMIT order
  persisted as `NEW` at its requested price without a cash check, a missing
  or non-positive `price` returning 400 `INVALID_REQUEST`, `price` supplied
  to MARKET returning 400 `INVALID_REQUEST`, `size`/`amount` XOR validation,
  decimal-safe flooring using the limit price, and an `amount` that floors
  to zero returning 201 with a persisted `REJECTED` order. Cover unknown user
  and instrument branches returning 404 `NOT_FOUND`. Do NOT validate
  cash/positions availability for LIMIT orders. Persist valid
  positive-size LIMIT orders as `NEW` regardless of user balance, without
  reserving cash or positions. Cash validation only applies to MARKET orders
  (EPIC-04). Add and run failing Supertest integration tests using real
  Prisma against local Docker Compose PostgreSQL for persisted order
  fields/status, the validation/error responses, and request IDs.
- **Work:** Add the LIMIT strategy implementation and register it in the
  create-order Strategy Map. Preserve the existing transaction and injected
  port boundaries. Persist positive-size LIMIT orders as `NEW` without
  matching or reserving cash/positions; persist a zero-size calculated order
  as `REJECTED`.
- **Verify:** Using only `DATABASE_LOCAL`, run
  `npm run db:local:up && npm run db:validate && npm run db:migrate &&
  npm run db:seed`, the create-order unit tests,
  `npm test test/integration/orders-limit-cancel.test.js`, and
  `npm run lint`. Confirm valid LIMIT orders return 201 `NEW`, invalid
  requests return 400 `INVALID_REQUEST`, unknown resources return 404
  `NOT_FOUND`, and calculated size zero returns 201 with a persisted
  `REJECTED` order. Do not run Neon or challenge-database commands.
- **Commit:** Commit this LIMIT-order creation vertical slice separately.
- **Citations:** [ADR-0001](../adrs/ADR-0001-stack-express-javascript.md),
  [ADR-0002](../adrs/ADR-0002-estructura-features-y-strategy.md),
  [ADR-0003](../adrs/ADR-0003-schema-normalizado.md),
  [ADR-0004](../adrs/ADR-0004-posiciones-derivadas-de-orders.md),
  [ADR-0005](../adrs/ADR-0005-semantica-de-ordenes.md),
  [ADR-0006](../adrs/ADR-0006-cantidad-vs-monto.md),
  [ADR-0007](../adrs/ADR-0007-validacion-y-errores.md),
  [ADR-0008](../adrs/ADR-0008-estrategia-de-testing.md),
  [ADR-0009](../adrs/ADR-0009-concurrencia-y-atomicidad.md),
  [ADR-0010](../adrs/ADR-0010-three-stage-database-environment.md),
  [ADR-0012](../adrs/ADR-0012-taxonomia-de-errores-y-mapeo-de-db.md),
  [ADR-0014](../adrs/ADR-0014-disponibilidad-pesos-por-operaciones.md),
  [ADR-0015](../adrs/ADR-0015-size-cero-solo-para-ordenes-rechazadas.md).

### 2. Deliver safe cancellation and complete the order lifecycle

- **TDD (red-first):** Add and run failing unit tests for the
  `assertCancelable` policy and cancellation use case before implementation.
  Cover `NEW` → `CANCELLED`, rejection of every non-`NEW` status with
  `ORDER_NOT_CANCELLABLE`, and no-match behavior for missing or foreign
  orders. Add and run failing real-Prisma Supertest integration tests against
  local Docker Compose PostgreSQL for successful cancellation, persistence of
  the new status, foreign-order anti-enumeration (404), non-`NEW` cancellation
  (409), validation errors, the ADR-0012 error codes/statuses, safe generic
  500 responses, and `X-Request-Id` on each response. Ensure the functional
  lifecycle coverage from ADR-0008 is green across the MARKET and LIMIT
  sessions.
- **Work:** Deliver `POST /api/orders/:id/cancel` with the established
  route/schema/execute separation and injected persistence ports. Change only
  an owned `NEW` order to `CANCELLED`; map non-cancellable state and
  not-found/foreign-order cases to their typed domain errors.
- **Verify:** Start and seed local PostgreSQL with
  `npm run db:local:up && npm run db:validate && npm run db:migrate &&
  npm run db:seed`, using `DATABASE_LOCAL`. Run
  `npm test test/integration/orders-limit-cancel.test.js
  test/integration/orders-create-market.test.js` and `npm run lint`. Confirm
  canceling a new LIMIT order returns 200 `CANCELLED`, canceling a non-`NEW`
  order returns 409 `ORDER_NOT_CANCELLABLE`, and canceling a foreign or
  unknown order returns 404 `NOT_FOUND`. Confirm all required lifecycle
  branches, error envelopes, and request-ID headers pass. Do not run Neon or
  challenge-database commands.
- **Commit:** Commit this cancellation and lifecycle-completion vertical
  slice separately.
- **Citations:** [ADR-0001](../adrs/ADR-0001-stack-express-javascript.md),
  [ADR-0002](../adrs/ADR-0002-estructura-features-y-strategy.md),
  [ADR-0005](../adrs/ADR-0005-semantica-de-ordenes.md),
  [ADR-0007](../adrs/ADR-0007-validacion-y-errores.md),
  [ADR-0008](../adrs/ADR-0008-estrategia-de-testing.md),
  [ADR-0010](../adrs/ADR-0010-three-stage-database-environment.md),
  [ADR-0011](../adrs/ADR-0011-graceful-shutdown.md),
  [ADR-0012](../adrs/ADR-0012-taxonomia-de-errores-y-mapeo-de-db.md).
