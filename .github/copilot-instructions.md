# Copilot instructions — cocos-challenge

## Session protocol

### Document hierarchy (precedence of truth)

When rules conflict or are ambiguous, resolve using this strict order:

1. **LEVEL 1 — Accepted ADRs** (`docs/adrs/ADR-NNNN-*.md` with status `Accepted`).
2. **LEVEL 2 — API contract** (`docs/api/openapi.yaml`).
3. **LEVEL 3 — Operational rules** (this file: `.github/copilot-instructions.md`).
4. **LEVEL 4 — Delivery order** (`docs/epics/BACKLOG.md` and per-epic `EPIC-NN.md`).

A lower-level document never overrides a higher-level one. If you detect a
contradiction between levels, STOP and ask the human before proceeding.

### Human-in-the-loop mandate

You are STRICTLY FORBIDDEN from guessing, assuming, or self-approving
architectural decisions.

- If a required rule is missing, ambiguous, or contradicts between documents,
  STOP and ask the human for clarification. Do NOT invent the rule.
- HITL gate: ONCE per session, at the story review before session close.
  Within a session, work autonomously: red-first internally, commit each
  step when it reaches green. Never guess, and never self-approve the
  session close (STATUS.md + AI_USAGE_LOG.md) — those require human approval.
- When in doubt, ask. A wrong assumption costs more than a question.

### Session state and detection

- `docs/epics/STATUS.md` is the ONLY source of truth for session state.
  One line per session, in execution order:
  `EPIC-01 S1 ✅ DONE (a1b2c3d)` or `EPIC-01 S2 ⬜`.
- On session start, read STATUS.md and run the FIRST session not marked
  DONE. Never skip ahead. Never re-run a DONE session.
- Read only the EPIC file that contains the detected session.
- If STATUS.md does not exist, create it first from docs/epics/BACKLOG.md
  (one line per session, all `⬜`) in its own docs-only commit, then proceed.

### Session lifecycle

- One session = one vertical slice. One commit per step, made when that step
  reaches green; the session close adds one final docs-only commit. A session
  ends only with its gates green (lint, tests). Never span two slices in one
  commit and never mix a feature with refactors of unrelated code.
- Decisions are never invented mid-implementation: if a binding rule is missing
  or two sources conflict, STOP and propose an ADR; the human accepts or
  rejects it before implementation resumes.
- Accepted ADRs are immutable; superseding one requires a new ADR that links to
  the superseded one.

### Working mode within a session

- Follow the session's TDD red-first steps, but do NOT stop for human
  approval at red or green. Run the whole session autonomously.
- After each step reaches green (its tests and gates pass), make ONE
  commit containing only that step. Code commits do not require approval.
- If a test cannot go green, or a binding rule is missing or two
  documents conflict, STOP and ask me. Never invent rules.

### Session close (the only human gate)

1. When every step is green and committed, present the session STORY:
   the demo/DoD evidence defined in the session (commands + expected
   output), the list of commits, and a summary of what changed.
2. WAIT for my approval. Do NOT touch STATUS.md or AI_USAGE_LOG.md yet.
3. After approval, in ONE docs-only commit: mark the session
   `✅ DONE (<last code commit hash>)` in STATUS.md, self-append the
   session entry to docs/AI_USAGE_LOG.md citing the ADRs used, and
   confirm with "Session logged to `docs/AI_USAGE_LOG.md`".

### AI Usage Log (mandatory, self-appended)

Every AI-assisted session MUST end with you **directly appending** an entry to
`docs/AI_USAGE_LOG.md`. Do NOT just remind the human — you MUST perform the
append yourself before ending the session. This is non-negotiable and part of
the Definition of Done of every session.

The log format is a Markdown table:

| Date       | Tool | Purpose | Prompt | Outcome / manual edits |
|------------|------|---------|--------|------------------------|
| YYYY-MM-DD | ...  | ...     | ...    | ...                    |

Rules for the log:

- **Timing**: the append happens at session close, AFTER human approval of
  the story, together with the STATUS.md update, in the same docs-only commit.
- **Self-append**: at the end of every session, you MUST edit
  `docs/AI_USAGE_LOG.md` and add a new row. Do not ask the human to do it.
- **Append-only**: never rewrite, reorder, or delete prior entries.
- **One row per session**: a session is a single AI-assisted interaction that
  produced code, docs, or decisions.
- **Faithful summary**: the `Prompt` column must reflect the actual intent of
  the prompt, not a paraphrase. The `Outcome` column must list accepted
  changes, rejected suggestions, and manual edits by the human.
- **Cite binding ADRs**: every row must reference the ADRs that governed the
  session (e.g., `ADR-0001, ADR-0005, ADR-0009`).
- **End-of-session confirmation**: after appending, output a line like:
  > Session logged to `docs/AI_USAGE_LOG.md`.
- If the log file does not exist yet, create it with the header row first.
- If you detect a missing entry from a prior session, catch it up before
  proceeding with the current session's work.

## Stack

- Node.js 20 LTS, JavaScript ES modules (no TypeScript, no build step),
  Express 4, Prisma 5, PostgreSQL (Neon, database provided by the challenge),
  Zod, pino, Jest + Supertest. (ADR-0001)
- Migrations are the schema source of truth, not the provided seed. The
  initial Prisma migration normalizes the basic provided schema (ADR-0003):
  snake_case naming (`user_id`, `previous_close`, `created_at`, `market_date`),
  FKs with `ON DELETE RESTRICT`, CHECK domain constraints (`size > 0`,
  `price > 0`, side/type/status enums), `NUMERIC(18,2)` for money, unique
  `instruments.ticker` / `users.email` / `marketdata (instrument_id,
  market_date)`, and performance indexes: partial `orders (user_id,
  instrument_id) WHERE status = 'FILLED'` plus `marketdata (instrument_id,
  market_date DESC)`. A seed script reloads the provided data. The provided
  seed itself is reloaded as-is, never "corrected".
- Read configuration from environment through one Zod schema at startup;
  fail before serving if invalid and report all detected errors. Only `PORT`
  defaults. Keep `.env` untracked and commit `.env.example`. Integration tests
  run against an isolated Neon branch, never the development database; seed
  deterministic test data per run. (ADR-0001, ADR-0008)
- Compensate the missing compiler deliberately: every port and exported
  function carries JSDoc `@typedef`/`@param`/`@returns` types, enforced by
  ESLint with `eslint-plugin-jsdoc`. No TypeScript tooling anywhere in the
  project: no `tsc`, no `tsconfig`, no build step. Zod parses — not merely
  validates — request bodies, so untrusted input has a checked shape before
  any use case runs. (ADR-0001, ADR-0007)

## Docs binding

- Binding precedence is `docs/adrs/*` > `docs/api/openapi.yaml` > this file > `docs/epics/*`.
  Never implement an unstated rule; stop and ask if a needed rule is absent or
  sources conflict.
- Only Accepted ADRs are binding. An ADR in Proposed status is a draft: this
  file must not cite it as an established rule, and if a citation points to a
  missing or Proposed ADR, treat the rule as unconfirmed and stop for human
  review.
- ADR filenames are `docs/adrs/ADR-NNNN-slug.md`, MADR format (Context,
  Decision, Alternatives, Consequences). Do not rename or renumber accepted
  ADRs.
- `docs/api/openapi.yaml` is the API contract: it defines endpoint
  request/response shapes, is validated as part of the lint gates, and is the
  seed for the Postman collection. It must not add or contradict the challenge
  letter. Keep shapes in one place: do not duplicate request/response
  schemas in prose docs.

## Architecture

- One endpoint is one folder under `src/features/<resource>/<endpoint>/`:
  `route.js` (Express wiring and HTTP only: status codes, `next(error)`),
  `schema.js` (Zod request/response schemas), `execute.js` (use case), with
  adjacent unit tests. No other layer touches `req`/`res`. Integration tests
  live in `test/integration/`. (ADR-0002)
- Shared kernel code lives in `src/shared/` (`errors.js`, `ports.js`,
  `policies/`). Promote something there only when at least two slices use it
  or duplication is demonstrated. `shared/` never imports `features/`.
  (ADR-0002)
- Dependencies point inward. `features/**/execute.js` never imports Express,
  Prisma, `@prisma/client`, or `shared/persistence`; it uses injected ports
  declared in `src/shared/ports.js` (repositories, market-data reader, and a
  transaction manager). `route.js` has no business logic; `schema.js` has no
  persistence logic; neither imports Prisma or `shared/persistence`.
  (ADR-0002, ADR-0009)
- `src/app.js` is the only composition root: it creates the Prisma client,
  repositories, and the transaction manager, then injects ports. No DI
  framework, no service locator, no generic CRUD repository. Use cases own
  transactions; repositories accept `{ tx }` via `TxOpts`. (ADR-0002,
  ADR-0009)
- Order execution is a Strategy: an `OrderExecutor` port with
  `market-executor.js` and `limit-executor.js`, selected by a plain `Map`
  keyed by order type inside the create-order use case. New order types add a
  file and a map entry, never edits to existing executors. (ADR-0002)
- Order creation is atomic: within one transaction, read available
  cash/positions and insert the order, so concurrent orders cannot
  double-spend. (ADR-0009)
- Portfolio and cash are derived, never materialized: aggregate `size` over
  `FILLED` orders per instrument (cash is the instrument with type `MONEDA`).
  The market-data repository alone owns the latest-price `DISTINCT ON
  ("instrument_id") ... ORDER BY "market_date" DESC` query; no other module
  contains raw SQL. Position performance compares volume-weighted average
  buy price against the latest `close`; daily return uses `close` vs
  `previousClose`. (ADR-0004)
- Register one error-handling middleware after all routes: it maps typed
  domain errors to `{ code, message, details? }` with semantic status codes
  and translates Prisma/pg errors; never leak stack traces or raw DB errors
  to clients. (ADR-0007)

## Domain rules

- Sides: `BUY`, `SELL`, `CASH_IN`, `CASH_OUT`. Types: `MARKET`, `LIMIT`.
  Statuses: `NEW`, `FILLED`, `REJECTED`, `CANCELLED`. Only `NEW` orders can be
  cancelled; cancelling any other status is a domain error mapped to 409.
  (ADR-0005)
- MARKET orders fill immediately at the latest `close` and must reject a
  `price` in the request. LIMIT orders persist in `NEW` with the requested
  price; there is no matching engine and no market simulation. (ADR-0005)
- Rejections are persisted: insufficient cash (BUY) or insufficient positions
  (SELL) still inserts the order with status `REJECTED` and the endpoint
  answers 201 with the persisted order. Never answer 400/422 without
  persisting the rejected order. (ADR-0005)
- Requests carry either `size` (whole shares) or `amount` (ARS). With
  `amount`, `size = floor(amount / reference price)`; `size = 0` is rejected.
  No fractional shares, no rounding up. Monetary math uses `decimal.js`,
  never float accumulation. (ADR-0006)
- Validate that user and instrument exist; unknown ids are 404. No
  authentication: `userId` is a request input, as the challenge states.

## Tests

- Red-first TDD on the create-order use case, executors, and policies: write
  and run contract-branch tests before implementation. Unit tests use
  in-memory fakes implementing ports, with Prisma absent; integration tests
  use real Prisma against the test Neon branch; never mock Prisma in
  integration tests. (ADR-0008)
- The functional e2e for `POST /orders` is mandatory and must cover: market
  BUY with funds → FILLED; market BUY without funds → REJECTED persisted;
  LIMIT → NEW; SELL without positions → REJECTED; cancel NEW → CANCELLED;
  cancel non-NEW → 409; `amount` flooring including the size 0 case.
  (ADR-0008)
- Keep at least 80% line coverage on `features/**/execute.js`, the order
  executors, and `shared/policies`. (ADR-0008)

## Codegen

- Keep modules small. Add JSDoc types to port definitions and exported
  functions. Use ESM imports with `.js` extensions; no default exports for
  use cases. (ADR-0001)
- Do not add a dependency without justification in the AI usage log. Do not
  add a DI framework, generic CRUD repository, events, CQRS, or other
  speculative abstractions. (ADR-0002)
- Never use `console.log`; log server-side errors with pino and request ID
  (`X-Request-Id` on every response, including operational and error
  responses). `/health` uses `SELECT 1` without exposing diagnostics.
  (ADR-0007)
- Before proposing a commit, run lint (including the JSDoc rules) and the
  applicable test gates; a fresh human review checks the commit against its
  binding ADRs.
