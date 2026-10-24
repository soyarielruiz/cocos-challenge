# Position sale-cost method

- Status: **Accepted**
- Amends: ADR-0004 (sale-cost method only)

## Context

ADR-0004 defines position cost using the volume-weighted average buy price and
says that sales reduce quantity while preserving the cost basis of the
remaining shares. Its “FIFO weighted” label can be read as lot matching, which
is not the intended method.

## Decision

Calculate a position's unit cost as the volume-weighted average price of its
`FILLED` buy orders. A `FILLED` sale reduces the position quantity but does not
change that unit cost for the remaining shares. If quantity is zero or
negative, report `performancePct: null`.

## Alternatives

- FIFO lot matching: rejected; it is not the sale-cost method defined by
  ADR-0004's decision text.

## Consequences

Position performance remains based on one weighted-average unit cost, without
tracking or matching individual purchase lots.
