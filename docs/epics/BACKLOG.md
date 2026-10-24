# Epic backlog

This is the derived delivery order only; it deliberately contains no session breakdowns. Each epic must receive human approval as an `EPIC-NN.md` at kickoff, before implementation, per the execution protocol. The API source of truth is [`./api/openapi.yaml`](./api/openapi.yaml); the epic scope below does not amend it.

## Layout
The service lives at the repository root: `src/`, `test/`, `package.json`.
Stack: Node.js 20 LTS, JavaScript ESM (no TypeScript, no build step), Express 4, Prisma 5, Zod, pino, Jest + Supertest.
All session commands, verify commands, and demos run from the repository root (`npm test`, `npm start`).

## Epic sequence

### EPIC-01 — Operators can start and inspect a trustworthy API

- **Business impact:** Developers and operators can run the service, distinguish healthy from unavailable database-backed operation, validate environment configuration fail-fast, and inspect the contract without exposing internal diagnostics.
- **Demo:** `npm ci && npm run db:migrate && npm run db:seed && npm start`. In a second terminal: `curl -i http://localhost:3000/health && npm test test/integration/health.test.js && npm run lint`.
- **Expected output:** `/health` returns HTTP 200, `{"status":"ok"}`, and an `X-Request-Id` header. The lint command passes, enforcing `eslint-plugin-jsdoc` rules. The health integration test passes against the real PostgreSQL database.
- **Binding outcome:** Deliver application startup with validated environment (Zod schema, fail-fast reporting all errors, only `PORT` defaults); normalized Prisma schema with FKs `ON DELETE RESTRICT`, CHECK constraints, `NUMERIC(18,2)` for money, and performance indexes ([ADR-0003](./adrs/ADR-0003-schema-normalizado.md)); request IDs, safe global error handler mapping to `{ code, message, details? }` ([ADR-0007](./adrs/ADR-0007-validacion-y-errores.md)); and graceful shutdown.
- **Core units / TDD:** No new core business use case is required for this epic. TDD applies to configuration validation contracts and the database-backed health check integration suite. ([ADR-0001](./adrs/ADR-0001-stack-express-javascript.md), [ADR-0003](./adrs/ADR-0003-schema-normalizado.md), [ADR-0007](./adrs/ADR-0007-validacion-y-errores.md)).

### EPIC-02 — Users can search for instruments by ticker or name

- **Business impact:** Investors can quickly find available assets to operate on, with results ordered by relevance.
- **Demo:** `curl "http://localhost:3000/api/instruments?search=app" && npm test test/features/instruments/search.test.js`.
- **Expected output:** The API returns an array of instruments matching "app" in ticker or name, with exact ticker matches sorted first. Jest prints `PASS` for the search integration suite against the real seeded database.
- **Binding outcome:** Deliver `GET /api/instruments?search=<term>`. The query uses `ILIKE` at the DB level. Missing or empty `search` returns 400 with all Zod validation errors. No full-text search indexes are added (YAGNI for ~66 instruments).
- **Core units / TDD:** Write red-first contract-branch unit tests for the search repository logic (using in-memory fakes if applicable, though this is mostly DB-driven), followed by the integration test asserting the `ILIKE` behavior and relevance sorting. ([ADR-0003](./adrs/ADR-0003-schema-normalizado.md), [ADR-0007](./adrs/ADR-0007-validacion-y-errores.md), [ADR-0008](./adrs/ADR-0008-estrategia-de-testing.md)).

### EPIC-03 — Users can view their portfolio with derived positions and performance

- **Business impact:** Users can see their total account value, available cash, and positions with quantity, market value, total performance (%), and daily change (%), calculated in real-time without materialized state.
- **Demo:** `curl "http://localhost:3000/api/users/1/portfolio" && npm test test/features/users/portfolio.test.js`.
- **Expected output:** The API returns the exact calculated `totalValue`, `availableCash`, and `positions` array matching golden values derived from the seeded `orders` and `marketdata`. Positions with `quantity <= 0` return `performancePct: null`.
- **Binding outcome:** Deliver `GET /api/users/:userId/portfolio`. Cash is derived from `FILLED` orders of the `MONEDA` instrument. Positions are derived by aggregating `size` of `FILLED` orders. Performance uses weighted-average cost: volume-weighted average price of `FILLED` buys, unchanged by sales. Daily change uses `close` vs `previousClose` from the latest `marketdata` (via `DISTINCT ON`). User not found returns 404.
- **Core units / TDD:** `calculatePerformance` policy and `getPositions` repository are core logic. Write their contract-branch unit tests red-first per [ADR-0008](./adrs/ADR-0008-estrategia-de-testing.md), using deterministic golden values and in-memory fakes. Follow with integration tests against real Prisma to verify the `DISTINCT ON` and aggregation SQL. ([ADR-0003](./adrs/ADR-0003-schema-normalizado.md), [ADR-0004](./adrs/ADR-0004-posiciones-derivadas-de-orders.md), [ADR-0008](./adrs/ADR-0008-estrategia-de-testing.md)).

### EPIC-04 — Users can execute MARKET orders with atomic validation (anti double-spend)

- **Business impact:** Users can buy or sell at the current market price. The system guarantees that concurrent orders from the same user cannot double-spend cash or positions, and rejected orders are auditable.
- **Demo:**
    1. `curl -X POST http://localhost:3000/api/orders -H "Content-Type: application/json" -d '{"userId":1,"instrumentId":1,"side":"BUY","type":"MARKET","size":10}'` (Expect 201 FILLED)
    2. `curl -X POST http://localhost:3000/api/orders -H "Content-Type: application/json" -d '{"userId":1,"instrumentId":1,"side":"BUY","type":"MARKET","amount":999999999}'` (Expect 201 REJECTED)
    3. `npm test test/features/orders/create-market.test.js`
- **Expected output:** MARKET BUY with funds returns 201 FILLED. MARKET BUY without funds returns 201 REJECTED (persisted in DB). MARKET with `price` in payload returns 400. Jest prints `PASS` for unit and integration suites, including the concurrency test.
- **Binding outcome:** Deliver `POST /api/orders` for MARKET type. Validates funds/positions. Calculates `size = floor(amount / close)` if `amount` is provided; `size = 0` results in REJECTED. Uses Strategy pattern (`market-executor.js`). Creation is atomic: a single transaction with `pg_advisory_xact_lock` on `userId` prevents race conditions. 400 is reserved strictly for contract/syntax errors.
- **Core units / TDD:** `validateFunds`, `validatePositions` policies, `market-executor`, and the `create-order` use case are core logic. Write red-first unit tests for all branches (FILLED, REJECTED by funds, REJECTED by positions, REJECTED by size=0, 400 by price). Write a specific integration test proving that two concurrent MARKET BUY requests from the same user without sufficient funds result in one REJECTED and no double-spend. ([ADR-0002](./adrs/ADR-0002-estructura-features-y-strategy.md), [ADR-0005](./adrs/ADR-0005-semantica-de-ordenes.md), [ADR-0006](./adrs/ADR-0006-cantidad-vs-monto.md), [ADR-0008](./adrs/ADR-0008-estrategia-de-testing.md), [ADR-0009](./adrs/ADR-0009-concurrencia-y-atomicidad.md)).

### EPIC-05 — Users can place LIMIT orders and cancel them safely

- **Business impact:** Users can place pending orders at a specific price and retain the ability to cancel them before execution, with strict state validation.
- **Demo:**
    1. `curl -X POST http://localhost:3000/api/orders -H "Content-Type: application/json" -d '{"userId":1,"instrumentId":1,"side":"BUY","type":"LIMIT","size":10,"price":100}'` (Expect 201 NEW)
    2. `curl -X POST http://localhost:3000/api/orders/{id}/cancel -H "Content-Type: application/json" -d '{"userId":1}'` (Expect 200 CANCELLED)
    3. `curl -X POST http://localhost:3000/api/orders/{filled_id}/cancel -H "Content-Type: application/json" -d '{"userId":1}'` (Expect 409)
- **Expected output:** LIMIT with price returns 201 NEW. LIMIT without price returns 400. Canceling NEW returns 200. Canceling non-NEW returns 409. Canceling foreign order returns 404.
- **Binding outcome:** Deliver `POST /api/orders` for LIMIT type (persists as NEW, no matching engine). Deliver `POST /api/orders/:id/cancel`. Validates that the order belongs to the `userId` and is in `NEW` state. Uses `limit-executor.js` via the Strategy Map.
- **Core units / TDD:** `limit-executor` and `assertCancelable` policy are core logic. Write red-first unit tests verifying NEW state allowance and non-NEW state rejection (409). Integration tests must verify the 404 anti-enumeration behavior for foreign orders. ([ADR-0002](./adrs/ADR-0002-estructura-features-y-strategy.md), [ADR-0005](./adrs/ADR-0005-semantica-de-ordenes.md), [ADR-0008](./adrs/ADR-0008-estrategia-de-testing.md)).

### EPIC-06 — The service can prove its release is safe, documented, and maintainable

- **Business impact:** Reviewers and evaluators get repeatable evidence that the delivered contract, architecture boundaries, and operational instructions remain aligned and testable without reading the source code.
- **Demo:** `npm test -- --coverage && npm run lint && npx @redocly/cli lint docs/api/openapi.yaml`. Import `docs/api/openapi.yaml` into Postman and run the full collection.
- **Expected output:** Jest enforces at least 80% line coverage for `features/**/execute.js`, executors, and `shared/policies`. Lint passes. OpenAPI validation passes. Postman collection executes all endpoints successfully against the seeded DB.
- **Binding outcome:** Consolidate release evidence: (a) Postman collection derived from OpenAPI; (b) README with run instructions, curl examples, domain assumptions (infinite liquidity at close, cash as MONEDA, weighted-average cost), and ADR mappings; (c) `docs/AI_USAGE_LOG.md` fully populated with session traces; (d) mechanical gates (ESLint `no-console`, JSDoc, coverage) passing.
- **Core units / TDD:** No new core logic is introduced. This epic enforces the 80% coverage floor mandated by [ADR-0008](./adrs/ADR-0008-estrategia-de-testing.md) on the red-first contract suites delivered by EPIC-03, EPIC-04, and EPIC-05.

---

## Coverage matrix

Every contracted endpoint and requested production-readiness outcome maps to the epic that delivers it and an executable verification.

| Contract or production-readiness item | Epic | Verification |
|---|---|---|
| Validated environment, isolated test DB, normalized schema (FKs, CHECKs, NUMERIC, indexes), and idempotent seeder ([ADR-0003](./adrs/ADR-0003-schema-normalizado.md)) | EPIC-01 | `npm run db:migrate && npm run db:seed` succeeds. Invalid env tests assert startup failure with all detected errors. |
| Runtime safeguards: request IDs, safe errors, JSDoc lint gate, graceful shutdown ([ADR-0001](./adrs/ADR-0001-stack-express-javascript.md), [ADR-0007](./adrs/ADR-0007-validacion-y-errores.md)) | EPIC-01 | `npm run lint` passes. `npm test test/integration/health.test.js` asserts `X-Request-Id` and safe error envelope. |
| `GET /health` — operational health | EPIC-01 | `curl -i http://localhost:3000/health` returns `200` and `{"status":"ok"}`. |
| `GET /api/instruments?search=...` — ILIKE search with relevance sorting | EPIC-02 | `npm test test/features/instruments/search.test.js` asserts exact ticker match first, and 400 on missing param. |
| `GET /api/users/:userId/portfolio` — derived positions, cash, performance, daily change | EPIC-03 | `npm test test/features/users/portfolio.test.js` asserts golden values for quantity, market value, `performancePct` (null if <=0), and `dailyChangePct`. |
| `POST /api/orders` (MARKET) — atomic validation, floor logic, 201 REJECTED | EPIC-04 | `npm test test/features/orders/create-market.test.js` asserts FILLED, REJECTED (persisted), 400 for price, and concurrency lock prevents double-spend. |
| `POST /api/orders` (LIMIT) & `POST /api/orders/:id/cancel` — NEW state, 409 on invalid cancel | EPIC-05 | `npm test test/features/orders/limit-cancel.test.js` asserts 201 NEW, 200 CANCELLED, 409 on non-NEW, 404 on foreign order. |
| Unit coverage consolidation: ≥80% line coverage for execute, executors, and policies ([ADR-0008](./adrs/ADR-0008-estrategia-de-testing.md)) | EPIC-06 | `npm test -- --coverage` fails below the required threshold; tests use port fakes, no Prisma mocks in unit tests. |
| Delivery README & Postman collection | EPIC-06 | Postman run succeeds. `cat README.md` contains ADR mappings, domain assumptions, and run instructions. |
