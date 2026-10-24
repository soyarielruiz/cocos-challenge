# Graceful HTTP server shutdown

- Status: **Accepted**
- Date: 2026-10-24

## Context

EPIC-01 requires graceful shutdown, but the accepted architecture decisions do
not define how the HTTP server and its Prisma connection are closed when the
process receives a termination signal.

## Decision

On `SIGINT` or `SIGTERM`, stop accepting new HTTP connections, wait for
in-flight HTTP requests to finish, disconnect Prisma, and then exit the
process.

## Alternatives

- Exit immediately on a termination signal: rejected because active requests
  could be interrupted and the database connection would not be explicitly
  closed.
- Disconnect Prisma before closing the HTTP server: rejected because active
  requests may still need the database.

## Consequences

### Positive

- Active requests can complete before the application closes its database
  connection and exits.

### Negative

- Shutdown waits for in-flight requests to finish.
