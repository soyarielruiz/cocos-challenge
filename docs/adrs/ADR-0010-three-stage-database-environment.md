# Three-stage database environment

- Status: **Accepted**
- Date: 2026-10-24
- Amends: [ADR-0008](ADR-0008-estrategia-de-testing.md), environment clause only

## Context

ADR-0008 currently uses an isolated Neon branch for integration tests and permits local PostgreSQL as a CI-runner fallback. Developing database migrations and seed flows directly against a hosted branch makes routine iteration depend on network access and risks confusion between test data and the challenge-provided database.

The project needs a repeatable local database for all development and routine testing, while retaining validation against the hosted PostgreSQL provider and protecting the provided database until delivery.

## Decision

Use three database stages:

1. **Local development and routine testing:** Run PostgreSQL with Docker Compose, pinning the service image to `postgres:18` to match Neon's major version. Use disposable/ephemeral database storage and load deterministic seed data. All development and routine test runs use this local database.
2. **Hosted integration validation:** After endpoint flows are functional, validate integration behavior against an isolated Neon branch. Do not use the development branch for these tests.
3. **Delivery:** Migrate and seed the challenge-provided database only at delivery.

This ADR changes only ADR-0008's database-environment clause. Its test levels, red-first approach, real-Prisma integration requirement, required functional e2e coverage, and minimum 80% coverage remain unchanged.

## Alternatives

- **Use an isolated Neon branch for all development and testing:** Rejected for routine work because it makes local iteration depend on the hosted database and keeps test setup coupled to remote infrastructure.
- **Use only local PostgreSQL:** Rejected because it would remove validation against the hosted PostgreSQL provider before delivery.
- **Use the provided database throughout development and testing:** Rejected because it risks changing challenge data before delivery and would not isolate test runs.

## Consequences

### Positive

- Routine development and tests run against a repeatable, disposable local database.
- Hosted integration validation remains a separate, explicit stage after endpoint behavior is functional.
- The challenge-provided database is protected from development and test mutations until delivery.

### Negative

- Contributors need Docker Compose and the pinned `postgres:18` image.
- Integration validation requires maintaining both a local workflow and isolated Neon branch access.
- Delivery must explicitly run and verify migrations and seed data against the provided database.
