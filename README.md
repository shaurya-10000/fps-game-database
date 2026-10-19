# FPS Game Database

Competitive FPS backend: canonical match recording, transactional outbox, ratings, matchmaking, tournaments, economy, and moderation.

**Design thesis:** one transactional write path is the source of truth. Everything else (ratings, statistics, leaderboards) is a *projection* derived from events, and can be rebuilt, replayed, or repaired without touching canonical data.

## Scope & Milestone Status

This repository contains the **domain layer** of the backend. It is built for correctness and tested against a real MongoDB Atlas replica set.

**What is included:**
- **Core Services:** `PlayerService`, `MatchService`, `CanonicalResultService`, `RatingProcessor`, `MatchmakingService`, `TournamentService`, `ModerationService`, `ProgressionService`, `InventoryService`, `LeaderboardService`, `SeasonService`, `MonitoringService`, `OutboxRelay`.
- **Infrastructure:** MongoDB client, structured logger, JWKS-backed `IdentityProvider`, auth middleware, failure injection harness, migrations, and verification scripts.
- **Content Catalog:** Versioned maps, weapons, characters, and game modes.
- **Testing:** 92 passing tests (25 unit, 67 integration) verifying transactions, idempotency, and outbox processing.

**What is NOT included (by design for this milestone):**
- An HTTP server. There is no route table or request pipeline.
- A worker daemon. `OutboxRelay` and `RatingProcessor` are classes; something must instantiate and drive them.
- Auth middleware wiring. Middleware exists; nothing calls it.
- CI running integration tests (requires a replica set).

Adding an HTTP transport, a worker loop, and CI-with-Atlas is the natural next milestone. The correctness of the pipeline does not depend on that transport existing.

## Requirements

- Node.js **>= 20.19.0**
- npm **>= 10**
- MongoDB **>= 7** running as a **replica set** (MongoDB Atlas is recommended).

## Quick Start

```bash
cp .env.example .env        # Set MONGODB_URI to your Atlas connection string
npm ci                      # Reproducible install
npm run typecheck           # Strict typecheck
npm run build               # Compile to dist/
npm test                    # Unit tests
npm run test:integration    # Integration tests (requires Atlas)
```

## Core Guarantees

| Guarantee | How it is proven |
|-----------|------------------|
| Zero duplicate canonical records under concurrent submission | 20-parallel test (`duplicate-load.test.ts`) |
| Full transaction rollback on any failure point | Failure injection (`canonical-result.test.ts`) |
| Ambiguous commit resolution (network drops ACK) | `ambiguous-commit.test.ts` |
| Exactly-once rating across crashes and retries | Worker crash recovery test |
| No out-of-order application | Sequence gap detection test |
| BOLA protection (404, not 403, on unauthorized) | `auth-middleware.test.ts` |
| Mass-assignment rejection at DB and API layer | Zod `.strict()` + `additionalProperties: false` |
| Mid-session account suspension enforcement | High-risk route re-check test |

## Architecture

Canonical truth plus event-driven projections.

```text
Canonical Transaction (ADR-001)
--------------------------------
matches, matchParticipants, outboxEvents, idempotencyRecords
        |
        v
Outbox Relay (lease-based claim)
        |
        v
Rating Processor (atomic sequence allocation)
        |
        v
competitiveRatings projection (read model)
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Compile `src/` to `dist/` |
| `npm run typecheck` | Strict typecheck of all sources |
| `npm test` | Unit tests (Vitest) |
| `npm run test:integration` | Integration tests against a replica set |
| `npm run seed` | Seed a deterministic dataset |
| `npm run verify:indexes` | Verify index inventory matches the database |
| `npm run migrate` | Run idempotent migrations |
| `npm run replay:dead-letter` | Replay a dead-lettered delivery |

## License

MIT