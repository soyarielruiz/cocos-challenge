# EPIC-06 — The release is evidenced and all database stages are validated

## Business impact

Reviewers can reproduce the local release gates, verify the complete API and
concurrency behavior against an isolated hosted database, and receive a
documented delivery against the provided database without putting that
database at risk before explicit human approval.

## Executable demo

Run the sessions in order from the repository root. Sessions 1 and 2 must not
connect to or modify the challenge-provided database.

### Session 1 — Local release gates and delivery documentation

With `.env` configured so `DATABASE_LOCAL` points to Docker Compose PostgreSQL:

```sh
npm run db:local:up
npm run db:validate
npm run db:migrate
npm run db:seed
npm test -- --coverage
npm run lint
npx @redocly/cli lint docs/api/openapi.yaml
```

Import `docs/api/openapi.yaml` into Postman, export the generated collection
to `postman/cocos-challenge.postman_collection.json`, and run it against the
locally seeded service.

### Session 2 — Hosted integration validation

Use a disposable Neon project owned by the developer, separate from the
project containing the challenge-provided database. Set `DATABASE_TEST` to
that project's TLS-required connection string. Prepare its schema and
deterministic seed using the repository's canonical seed script. The setup
scripts (`db:validate`, `db:migrate`, `db:seed`) and test process resolve their
target database as `DATABASE_TEST` when set, falling back to `DATABASE_LOCAL`;
`.env` is never modified. Then run:

```sh
export DATABASE_TEST='<disposable Neon project URI>'
npm run db:validate && npm run db:migrate && npm run db:seed && npm test
```

Verify from the active database connection that TLS is enabled and PostgreSQL
major version is 18. After the session story has been reviewed, the developer
deletes the disposable project.

### Session 3 — Gated delivery against the provided database

**Before approval, and before any schema or data operation on the provided
database**, make and verify a custom-format backup outside the repository:

```sh
export PROVIDED_DATABASE_URL='<provided database connection string>'
pg_dump --format=custom --clean --if-exists --no-owner --no-acl \
  --file="$BACKUP_FILE" "$PROVIDED_DATABASE_URL"
pg_restore --list "$BACKUP_FILE" >/dev/null
openssl dgst -sha256 "$BACKUP_FILE"
```

The verified, checksummed dump is the required recovery point; an optional
secondary plain-format dump may be stored in a second location. Then **stop
and wait for explicit user approval**. Do not baseline, migrate, seed, run a
smoke test, or otherwise touch the provided database before that approval.

After explicit approval, choose baseline or migration based on the actual
schema and migration history; reload the provided seed without correcting it,
then run the smoke checks against the provided database. Record the actual
backup location, checksum, schema action, seed result, smoke results, and
restore steps in `README.md`. Keep the dump and all connection strings out of
version control and logs.

For the approved delivery run, export `PROVIDED_DATABASE_URL` in the shell
only. Select it using the same precedence as hosted validation:
`DATABASE_TEST` when set, falling back to `DATABASE_LOCAL`. Never write the
provided connection string to `.env`, commit it, or log it. For example,
after choosing the applicable baseline/migration action and reloading the
seed, start the API in one terminal:

```sh
DATABASE_TEST="$PROVIDED_DATABASE_URL" npm start
```

In a second terminal, run:

```sh
curl -i http://localhost:3000/health
curl -i "http://localhost:3000/api/instruments?search=banco"
curl -i http://localhost:3000/api/users/1/portfolio
curl -i -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":99999999,"instrumentId":1,"side":"BUY","type":"MARKET","size":1}'
```

## Expected output

- Local tests, the configured coverage thresholds, ESLint, and Redocly OpenAPI
  lint pass. Coverage is at least 80% for every in-scope file group.
- The exported Postman collection is derived from the OpenAPI contract and
  passes against the deterministic local database.
- The README gives reproducible run instructions and curl examples, documents
  all required domain assumptions and ADR mappings, and explains database
  backup and restore.
- The complete test suite, including health, instrument search, portfolio,
  MARKET, LIMIT, cancellation, and concurrency cases, passes against the
  disposable Neon project using `DATABASE_TEST`; connection evidence confirms
  TLS and PostgreSQL 18 parity. The developer deletes the project after story
  review.
- Delivery against the provided database occurs only after the required
  backup is verified and checksummed and explicit approval has been received.
  The seed is reloaded as-is and the smoke checks pass.

## Definition of done

- Enforce the ADR-0008 minimum **80% line coverage** on
  `features/**/execute.js`, both order executors, and `shared/policies`.
  The threshold is a failing gate, not a reported metric alone.
- Validate `docs/api/openapi.yaml` with `@redocly/cli lint`. Generate the
  committed Postman collection from that OpenAPI contract rather than
  duplicating request or response schemas by hand; run the collection against
  the deterministic local database.
- Deliver `README.md` with local run/migration/seed instructions, curl
  examples, and a concise ADR map: stack/configuration/schema/environment and
  shutdown (ADR-0001, 0003, 0010, 0011); feature boundaries and strategy
  (ADR-0002); derived positions and cash, including the amended cash rule and
  sale-cost method (ADR-0004, 0013, 0014); order lifecycle, amount flooring,
  atomicity, and zero-size constraint (ADR-0005, 0006, 0009, 0015);
  validation/error handling (ADR-0007, 0012); and testing/coverage (ADR-0008).
  Explain these domain assumptions precisely:
  - MARKET execution assumes infinite market liquidity at the latest `close`;
    the service does not simulate an order book.
  - Cash is represented by the `MONEDA` instrument, but available cash is
    derived using ADR-0014's netting rule: FILLED CASH_IN/CASH_OUT movements
    and FILLED asset BUY/SELL values. Do not describe cash as only the sum of
    MONEDA orders.
  - Position performance uses volume-weighted average buy cost; FILLED sales
    reduce quantity without changing the remaining unit cost.
  - An amount that floors to `size = 0` is persisted as `REJECTED`; only a
    REJECTED order may have zero size.
  - LIMIT orders remain `NEW` and do not reserve cash or positions.
- Verify `docs/AI_USAGE_LOG.md` is complete for the recorded sessions and
  append-only; do not rewrite, reorder, or remove prior rows.
- Keep the database stages isolated: routine/release checks use
  `DATABASE_LOCAL`; hosted integration validation uses only the disposable
  Neon project through `DATABASE_TEST`; the provided database is not touched
  until delivery and explicit approval.
- Hosted validation runs the **entire** test suite against a deterministically
  seeded disposable Neon project, including the required functional order
  lifecycle and every existing concurrency case. Confirm TLS is enabled and
  the PostgreSQL major version matches the local `postgres:18` image. The
  developer deletes the project after story review.
- For delivery, first create, verify, and checksum the required `pg_dump`
  backup. Stop at that gate and wait for explicit approval before any access
  that can mutate the provided database. After approval, baseline or migrate
  according to the actual schema state, reload the supplied seed as-is, and
  run the smoke test: `/health`, instrument search, portfolio, and an order
  request with an unknown user that returns 404 without persisting an order.
  Document backup and restore procedures in the README, including
  `pg_restore --clean --if-exists --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"`
  for the custom-format dump.
- Every session has an executable demo/DoD with commands and expected output,
  red-first tests where tests are added or changed, and citations. No code or
  database action from a later session is pulled into an earlier one.

## Ordered sessions

### 1. Enforce local release gates and complete the delivery docs

- **TDD (red-first):** There is no new business behavior in this session. If
  the coverage gate or its configuration needs a change, first add and run a
  focused failing test proving that below-threshold coverage fails; then add
  the gate and verify the in-scope thresholds. Do not add tests solely to
  inflate coverage. Run the complete suite against Docker Compose PostgreSQL
  via `DATABASE_LOCAL`.
- **Work:** Configure the 80% line-coverage floor for
  `features/**/execute.js`, the order executors, and `shared/policies`.
  Validate the OpenAPI contract with `npx @redocly/cli lint
  docs/api/openapi.yaml`. Import that contract into Postman and export the
  collection to `postman/cocos-challenge.postman_collection.json`. Write the
  README with local setup/run instructions, curl examples, all domain
  assumptions listed in the Definition of done, and links mapping the
  behavior to accepted ADRs. Check that the AI usage log accounts for the
  completed sessions and preserve its append-only history.
- **Verify:** Using only `DATABASE_LOCAL`, run
  `npm run db:local:up && npm run db:validate && npm run db:migrate &&
  npm run db:seed`, `npm test -- --coverage`, `npm run lint`, and
  `npx @redocly/cli lint docs/api/openapi.yaml`. Confirm each in-scope
  coverage group meets 80%, import/run the generated Postman collection
  against the local seeded service, and review the README/log requirements.
  Expected output: all commands and collection requests pass; no connection
  to Neon or the provided database is made in this session.
- **Commit:** Commit the release-gate and documentation slice separately.
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
  [ADR-0011](../adrs/ADR-0011-graceful-shutdown.md),
  [ADR-0012](../adrs/ADR-0012-taxonomia-de-errores-y-mapeo-de-db.md),
  [ADR-0013](../adrs/ADR-0013-metodo-de-costo-de-venta.md),
  [ADR-0014](../adrs/ADR-0014-disponibilidad-pesos-por-operaciones.md),
  [ADR-0015](../adrs/ADR-0015-size-cero-solo-para-ordenes-rechazadas.md).

### 2. Validate the complete suite against a disposable Neon project

- **TDD (red-first):** Before changing integration-test database selection or
  test/bootstrap configuration, add and run failing tests showing hosted runs
  use `DATABASE_TEST` and local runs continue to use `DATABASE_LOCAL`. Preserve
  real Prisma integration tests and deterministic per-run test data. Include
  the existing concurrency cases; do not mock Prisma or use the Neon
  development project.
- **Work:** Use a disposable Neon project owned by the developer and separate
  from the project containing the provided database. Point `DATABASE_TEST` at
  it and ensure the setup scripts (`db:validate`, `db:migrate`, `db:seed`) and
  full suite's Prisma-backed integration tests resolve their target as
  `DATABASE_TEST` when set, falling back to `DATABASE_LOCAL`. Keep routine
  tests on Docker Compose PostgreSQL through `DATABASE_LOCAL` when
  `DATABASE_TEST` is unset. Seed only through the repository's canonical seed
  script; do not make ad-hoc seed copies. Never modify `.env`. Verify the
  active connection uses TLS and reports PostgreSQL major version 18. Record
  results without logging credentials. After story review, the developer
  deletes the disposable project.
- **Verify:** Against the project selected by `DATABASE_TEST`, prepare the
  schema and deterministic seed. Both setup scripts and the test process
  select `DATABASE_TEST` when set, falling back to `DATABASE_LOCAL`; do not
  modify `.env`. Then run
  `npm run db:validate && npm run db:migrate && npm run db:seed && npm test`
  with `DATABASE_TEST` set. If a concurrency case is flaky only against the
  hosted project due to cold-start latency, add a warm-up request (for example,
  `GET /health`) before the suite; do not weaken or modify the concurrency
  test itself. Expected output: the entire Jest suite passes,
  including health, instrument search, portfolio, MARKET and LIMIT order
  behavior, cancellation, the mandatory functional lifecycle, and all
  concurrency cases. Confirm TLS is active and server major version is 18.
  After story review, the developer deletes the isolated project. Do not
  access or mutate the provided database.
- **Commit:** Commit only the hosted-test selection/bootstrap changes and
  their tests as this session's separate slice.
- **Citations:** [ADR-0001](../adrs/ADR-0001-stack-express-javascript.md),
  [ADR-0003](../adrs/ADR-0003-schema-normalizado.md),
  [ADR-0008](../adrs/ADR-0008-estrategia-de-testing.md),
  [ADR-0009](../adrs/ADR-0009-concurrencia-y-atomicidad.md),
  [ADR-0010](../adrs/ADR-0010-three-stage-database-environment.md),
  [ADR-0016](../adrs/ADR-0016-aislamiento-validacion-proyecto-.md).

### 3. Gate delivery to the provided database and document recovery

- **TDD (red-first):** Before any post-approval delivery operation, verify the
  smoke procedure on an isolated/local database. Do not use the provided
  database for test-driven iteration. At the start of delivery, create the
  `pg_dump` backup, verify it with `pg_restore --list`, and checksum it. Then
  stop and wait for explicit user approval; approval to create the backup is
  not approval to mutate the provided database.
- **Work:** Only after explicit approval, inspect the provided database's
  schema and migration history and select the applicable baseline or
  migration path; do not guess or apply both blindly. Reload the provided
  seed as-is. For the smoke run, use a connection string exported in the
  shell for this run only (for example, `PROVIDED_DATABASE_URL`) and select
  the target with the same rule as `DATABASE_TEST`: `DATABASE_TEST` when set,
  falling back to `DATABASE_LOCAL`. Never write it to `.env`, commit it, or
  log it. Run the smoke test (health, instrument search, portfolio, and a
  POST to `/api/orders` with an unknown `userId`, expecting 404 NOT_FOUND
  without persisting an order). This exercises the full request path and
  unknown-user database read under the user lock without persisting anything
  into the delivered database. Then document the verified backup and restore
  procedure and delivery evidence in `README.md`. Restore the custom-format
  dump with `pg_restore --clean --if-exists --no-owner --no-acl` to an
  isolated recovery database or explicitly approved recovery target.
- **Verify:** The pre-approval verification is limited to the custom-format
  backup passing `pg_restore --list` and having its checksum recorded. Stop
  there until explicit approval. After approval, run the selected baseline or
  migration, reload the unchanged seed, and run the smoke test against the
  provided database. Expected output: migration/baseline and seed complete
  successfully; `/health` returns HTTP 200 with `{"status":"ok"}` and
  `X-Request-Id`; instrument search and portfolio return their contract
  responses with `X-Request-Id`; the order request returns 404 NOT_FOUND with
  `X-Request-Id` and does not persist an order; the README contains tested
  `pg_restore --clean --if-exists` backup/restore instructions and records
  recovery evidence without containing secrets.
- **Commit:** Commit the delivery documentation and evidence separately after
  the approved delivery checks pass. Do not include backup files, connection
  strings, or unrelated implementation changes.
- **Citations:** [ADR-0003](../adrs/ADR-0003-schema-normalizado.md),
  [ADR-0007](../adrs/ADR-0007-validacion-y-errores.md),
  [ADR-0008](../adrs/ADR-0008-estrategia-de-testing.md),
  [ADR-0010](../adrs/ADR-0010-three-stage-database-environment.md),
  [ADR-0012](../adrs/ADR-0012-taxonomia-de-errores-y-mapeo-de-db.md).
