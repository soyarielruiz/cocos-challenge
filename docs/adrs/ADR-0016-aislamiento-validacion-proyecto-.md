# Hosted validation in a separate Neon project

- Status: **Accepted**
- Date: 2026-10-25
- Deciders: Ariel Ruiz
- Amends: [ADR-0010](ADR-0010-three-stage-database-environment.md), stage 2 and the stage 3 recovery point

## Context

The provided Neon project is credentials-only, with no console or branch-management access. A disposable branch cannot be created there. Hosted integration validation still needs a target isolated from both the challenge-provided database and development data.

## Decision

Run hosted integration validation against a disposable Neon project owned by the developer, separate from the project containing the provided database. Load its deterministic test data using the repository's canonical seed script; do not create ad-hoc seed copies. After the session story has been reviewed, the developer deletes the disposable project.

For stage 3, the recovery point is a verified custom-format `pg_dump` backup: `pg_restore --list` must succeed and the dump must be checksummed. An optional secondary plain-format dump may be stored in a second location. Creating these backups requires only the provided database connection string. A Neon safety branch is not possible with credentials-only access and is not required.

## Alternatives

- **Create a branch in the provided Neon project:** Unavailable because access is credentials-only and provides no branch-management capability.
- **Use the provided database for hosted tests:** Rejected because it is not isolated from challenge data.
- **Require a Neon safety branch as the stage 3 recovery point:** Unavailable with credentials-only access; the verified, checksummed custom-format dump is the required recovery point, with a secondary plain-format dump optional.

## Consequences

### Positive

- Hosted tests run against a disposable PostgreSQL 18 Neon target isolated at the project level from the provided database.
- The repository's canonical seed script remains the only test-data loading path.
- Stage 3 has a verifiable recovery artifact that can be created using the database connection string alone.

### Negative

- The developer must provision and delete the disposable Neon project outside this repository workflow.
- Recovery depends on retaining and validating the dump files; no server-side Neon branch is available as a secondary recovery point.
