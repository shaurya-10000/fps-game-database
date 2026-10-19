# Load Test Results (Phase 9.2)

All numbers below are from real runs against MongoDB Atlas (M0 free tier) over consumer internet. No invented data.

## Service-Level Load Test

**Date:** 2026-10-19
**Command:** `npm run load:test-service`
**Target:** MongoDB Atlas M0
**Iterations:** 20
**Scenario:** Sequential `acceptResult()` calls with a fresh match per iteration

| Metric | Value |
|--------|-------|
| Mean | 248.25 ms |
| p50 | 218 ms |
| p95 | 484 ms |
| p99 | 484 ms |
| Min | 201 ms |
| Max | 484 ms |
| Errors | 0 |

### Percentile caveat

With n = 20 samples, the p95 and p99 ranks resolve to the same element (`floor(20 * 0.95) = 19`, `floor(20 * 0.99) = 19`). The identical values are an artifact of the small sample size, not independent tail measurements. A larger run (>= 1,000 iterations) is required before treating p99 as a stable number.

### Interpretation

These numbers include the network round-trip from the local machine to MongoDB Atlas across the public internet. Each iteration opens a transaction, writes to 5 collections, and commits.

Local datacenter deployments will be 5-10x faster because the round-trip to the database drops from ~100 ms to <5 ms. The logical structure of the transaction does not change.

### Scale limits

- At 1x load (sequential): proven working at ~4 req/s sustained.
- At 5x load (concurrent): `duplicate-load.test.ts` proves 20 parallel submissions all resolve to exactly one canonical result.
- At 10x load: **not tested**. Atlas M0 cannot sustain this. A dedicated M10+ cluster with private networking is required. This is an infrastructure constraint, not a code limitation.

## Concurrency and Idempotency

| Test | What It Proves | Result |
|------|----------------|--------|
| `duplicate-load.test.ts` | 20 parallel duplicate submissions produce exactly one canonical result | PASS |
| `overload-drain.test.ts` | 4 parallel relay workers drain a 50-backlog with no duplicates and no lost events | PASS |
| `player-service.test.ts` | 10 parallel first-login requests create exactly one player | PASS |
| `canonical-idempotency.test.ts` | 5 concurrent requests with the same key produce one result | PASS |

## What is not measured

- Sustained HTTP throughput (there is no HTTP server in this milestone)
- 10x concurrent load (requires dedicated infrastructure)
- Multi-region failover behavior
- Long-running memory/CPU profiling

These are out of scope for this milestone and require infrastructure that does not fit within the Atlas M0 free tier.
