# Cocos Challenge Backend

Express API for instrument search, derived portfolios, and investment orders.
The API contract is [`docs/api/openapi.yaml`](docs/api/openapi.yaml); use it
for the authoritative request and response shapes.

## Local setup

Requirements: Node.js 20 LTS, npm, and Docker Compose.

```sh
npm ci
cp .env.example .env
```

Keep `.env` local and set `DATABASE_LOCAL` to the PostgreSQL 18 Docker Compose
service. Do not put Neon or challenge-provided database credentials in `.env`.
Then prepare and start the local database:

```sh
npm run db:local:up
npm run db:validate
npm run db:migrate
npm run db:seed
npm start
```

The Compose database uses ephemeral storage. To stop it:

```sh
npm run db:local:down
```

## API examples

Run the service locally, then use the seeded IDs or IDs from your local data:

```sh
curl -i http://localhost:3000/health
curl -i "http://localhost:3000/api/instruments?search=banco"
curl -i http://localhost:3000/api/users/1/portfolio
curl -i -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"instrumentId":1,"side":"BUY","type":"MARKET","size":1}'
```

There is no authentication; `userId` is supplied by the request as defined by
the challenge. Responses include `X-Request-Id`. See the OpenAPI contract for
all routes, validation rules, and response schemas.

## Domain assumptions

- MARKET orders execute immediately at the latest `close`; the service assumes
  infinite liquidity at that price and does not simulate an order book.
- LIMIT orders remain `NEW`; they do not reserve cash or positions and there
  is no matching engine.
- Cash is represented by the `MONEDA` instrument. Available ARS is derived by
  netting FILLED `CASH_IN` and `CASH_OUT` movements with FILLED asset BUY and
  SELL values, using each trade order's own price. NEW, REJECTED, and CANCELLED
  orders do not affect cash.
- Position performance uses volume-weighted average cost of FILLED buys.
  FILLED sales reduce quantity without changing the remaining unit cost.
  Performance is `null` when quantity is zero or negative.
- For `amount` requests, size is `floor(amount / reference price)`; fractional
  shares are never created. An amount that floors to zero is persisted as
  `REJECTED`; only REJECTED orders may have zero size.
- Business rejections are persisted as REJECTED orders. Contract errors are
  not persisted as orders.

## Tests and release gates

Run the complete local suite, including coverage gates, and lint the code and
API contract:

```sh
npm test -- --coverage
npm run lint
npx --yes @redocly/cli lint docs/api/openapi.yaml
```

Jest enforces at least 80% line coverage for each feature `execute.js`, both
order executors, and every shared policy. Integration tests use real Prisma
against `DATABASE_LOCAL` when `DATABASE_TEST` is unset.

The Postman collection is generated from the OpenAPI contract and is stored
at [`postman/cocos-challenge.postman_collection.json`](postman/cocos-challenge.postman_collection.json).
Import that file into Postman and set its `baseUrl` variable to
`http://localhost:3000` before running it against the locally seeded service.

## Database stages and recovery

Routine development and tests use the ephemeral local PostgreSQL service
through `DATABASE_LOCAL` when `DATABASE_TEST` is unset. For hosted integration
validation, use a disposable Neon project owned by the developer and separate
from both the development project and the project containing the
challenge-provided database. Set `DATABASE_TEST` in the shell for that run;
Jest and the `db:validate`, `db:migrate`, and `db:seed` scripts select it when
set and otherwise fall back to `DATABASE_LOCAL`. Keep `.env` unchanged. Load
deterministic data only with the repository's canonical seed script. Run the
complete suite with:

```sh
export DATABASE_TEST='<disposable Neon project URI>'
npm run db:validate && npm run db:migrate && npm run db:seed && npm test
```

Use a TLS-required connection and verify TLS and PostgreSQL major version 18.
Record the outcome without logging credentials. The developer deletes the
disposable project after story review. The challenge-provided database is
reserved for delivery.

Before any delivery operation that can mutate the provided database:

1. Export its connection string as `PROVIDED_DATABASE_URL` in the shell only.
   Never write it to `.env`, source control, or logs.
2. Create a custom-format dump outside the repository and verify it:

   ```sh
   pg_dump --format=custom --clean --if-exists --no-owner --no-acl \
     --file="$BACKUP_FILE" "$PROVIDED_DATABASE_URL"
   pg_restore --list "$BACKUP_FILE" >/dev/null
   openssl dgst -sha256 "$BACKUP_FILE"
   ```
3. Stop and wait for explicit approval before baseline, migration, seeding,
   smoke tests, or any other access that can mutate the provided database.

To restore, use an isolated recovery database or an explicitly approved
recovery target, never the source by accident:

```sh
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"
```

The hosted S2 result is recorded in
[`docs/AI_USAGE_LOG.md`](docs/AI_USAGE_LOG.md).

### Delivery evidence (provided database, 2026-10-25)

Commands were run by the developer in a local shell with the connection string
exported only there; it was never written to `.env`, source control, or logs.

- **Backup:** custom-format `pg_dump --clean --if-exists --no-owner --no-acl`
  stored outside the repository as `cocos-provided-backup.dump`; verified with
  `pg_restore --list`. SHA-256:
  `f88d8ee0981213e77d99959ee0f54c49a75755d6c0c57ac979f9c78a15aa4596`.
  An earlier dump checksum reported before the gate
  (`6c6e4bcc…3eca`) is superseded by this verified dump.
- **Pre-delivery inspection (read-only):** migration history already recorded
  `20261023000000_normalize_schema` (baseline not needed, no
  `migrate resolve`). The ADR-0003 indexes `orders_user_instrument_filled_idx`,
  `marketdata_instrument_market_date_desc_idx`, and the unique
  `(instrument_id, market_date)` index existed, so no index changes were made.
  Counts: 4 users, 66 instruments, 11 orders, 126 marketdata rows.
- **Schema action:** `DATABASE_TEST="$PROVIDED_DATABASE_URL" npm run db:migrate`
  applied only `20261024000000_rejected_zero_size_orders` (ADR-0015).
- **Seed:** `npm run db:seed` reloaded the provided seed as-is (not corrected;
  the legacy BMA SELL leaves user 1 with a net position of -10, per ADR-0004).
- **Smoke (API started with `DATABASE_LOCAL="$PROVIDED_DATABASE_URL"`):**
  `/health` 200 `{"status":"ok"}`; `/api/instruments?search=banco` 200 with four
  matches; `/api/users/1/portfolio` 200 (`totalValue` 889756, `availableCash`
  753000); `POST /api/orders` with `userId` 99999999 returned 404 `NOT_FOUND`.
  Every response carried `X-Request-Id`. Afterwards the orders table still held
  11 rows, none for user 99999999.
- **Restore:** to an isolated recovery database or an explicitly approved
  target, use the `pg_restore --clean --if-exists --no-owner --no-acl`
  command above with `RESTORE_DATABASE_URL`. A restore into a recovery target
  was not exercised in this session; only `pg_restore --list` was verified.

## Architecture decision records

- [ADR-0001](docs/adrs/ADR-0001-stack-express-javascript.md),
  [ADR-0010](docs/adrs/ADR-0010-three-stage-database-environment.md), and
  [ADR-0011](docs/adrs/ADR-0011-graceful-shutdown.md): stack, configuration,
  database stages, and shutdown. ADR-0016 amends hosted validation isolation
  and the stage-3 recovery point:
  [ADR-0016](docs/adrs/ADR-0016-aislamiento-validacion-proyecto-.md).
- [ADR-0002](docs/adrs/ADR-0002-estructura-features-y-strategy.md): feature
  boundaries and order-executor strategy.
- [ADR-0004](docs/adrs/ADR-0004-posiciones-derivadas-de-orders.md),
  [ADR-0013](docs/adrs/ADR-0013-metodo-de-costo-de-venta.md), and
  [ADR-0014](docs/adrs/ADR-0014-disponibilidad-pesos-por-operaciones.md):
  derived positions, sale cost, and available cash.
- [ADR-0005](docs/adrs/ADR-0005-semantica-de-ordenes.md),
  [ADR-0006](docs/adrs/ADR-0006-cantidad-vs-monto.md),
  [ADR-0009](docs/adrs/ADR-0009-concurrencia-y-atomicidad.md), and
  [ADR-0015](docs/adrs/ADR-0015-size-cero-solo-para-ordenes-rechazadas.md):
  order lifecycle, amount flooring, atomicity, and zero-size rejection.
- [ADR-0007](docs/adrs/ADR-0007-validacion-y-errores.md) and
  [ADR-0012](docs/adrs/ADR-0012-taxonomia-de-errores-y-mapeo-de-db.md):
  validation, request IDs, and error handling.
- [ADR-0008](docs/adrs/ADR-0008-estrategia-de-testing.md): test strategy and
  coverage requirements.
