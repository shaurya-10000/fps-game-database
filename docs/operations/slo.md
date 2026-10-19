# Service Level Objectives (Phase 9.8)

## Measured SLOs

All numbers below are measured on MongoDB Atlas M0 over consumer internet. See `load-test-results.md` for full context.

| Metric | Measured | Source |
|--------|----------|--------|
| `acceptResult` mean latency | 248 ms | `load:test-service` |
| `acceptResult` p50 | 218 ms | `load:test-service` |
| `acceptResult` p95 | 484 ms | `load:test-service` (n=20) |
| `acceptResult` p99 | 484 ms | `load:test-service` (n=20; see caveat) |
| Error rate (5xx) | 0% | All test runs pass |
| Concurrent duplicate submissions | 20 -> 1 canonical result | `duplicate-load.test.ts` |
| Parallel relay workers | 4 workers drain a 50-item backlog | `overload-drain.test.ts` |
| Parallel first-login requests | 10 -> 1 player created | `player-service.test.ts` |
| Referential integrity | 0 orphans across 1,000 matches | `verify:backup-restore` |

### Percentile caveat

The p95 and p99 values are identical **by construction** at n=20 (`floor(20 * 0.95) = 19`, `floor(20 * 0.99) = 19`). Treat them as an upper bound on observed latency for this sample, not independent tail measurements.

## Target SLOs (proposed, not yet measured)

These are **goals**, not claims. Each row lists what is actually blocking measurement.

| Target Metric | Goal | Blocked by |
|--------------|------|-----------|
| `acceptResult` p99 (colocated) | < 50 ms | Requires same-datacenter DB deployment |
| Sustained HTTP throughput | > 500 req/s | Requires an HTTP server (not present in this milestone) |
| Multi-region failover | < 5 s | Requires multi-region infrastructure |

## Availability

- Target: 99.9% monthly uptime
- **Not measured.** Requires production deployment and external health checks.

## Honest assessment

This system's **logical correctness** is proven by the integration test suite (see `npm run test:integration`). Its **performance on the free tier** is measured (248 ms p50, 484 ms p95/p99 with the caveat above). Its **production performance** — what a paying customer would experience — is not yet measured because that requires infrastructure this milestone does not include.

The code paths are production-shaped; the production numbers are pending a production cluster and an HTTP front end.
