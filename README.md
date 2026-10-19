<div align="center">

  # 🎮 FPS Game Database

  **A cloud-deployed backend for competitive FPS games.**

  Canonical match recording, transactional outbox, sequence-ordered Elo ratings, matchmaking, tournaments, and moderation, built so every match result is recorded once and only once, even when networks and workers fail.

  [![CI](https://github.com/shaurya-10000/fps-game-database/actions/workflows/ci.yml/badge.svg)](https://github.com/shaurya-10000/fps-game-database/actions/workflows/ci.yml)
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
  [![Node.js](https://img.shields.io/badge/Node.js-20.19+-green?logo=node.js)](https://nodejs.org)
  [![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://www.mongodb.com/atlas)
  [![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

  [**Live API Health Check**](https://fps-game-database.onrender.com/health) · [**Report a bug**](https://github.com/shaurya-10000/fps-game-database/issues)

</div>

---

## Contents

- [Highlights](#highlights)
- [Features](#features)
- [Architecture](#architecture)
- [Game content catalog](#game-content-catalog)
- [Core guarantees](#core-guarantees)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Operations and documentation](#operations-and-documentation)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Highlights

- **Exactly-once effect.** Match results are recorded once, even if clients retry, networks drop acknowledgements, or workers crash mid-flight.
- **Event-driven projections.** Ratings, XP, and leaderboards are derived asynchronously through a transactional outbox. They can be rebuilt from scratch without touching canonical data.
- **Strict ordering.** Per-player rating sequences are enforced atomically. Out-of-order events are deferred, duplicates are no-ops, and gaps block application until resolved.
- **Security by design.** BOLA-safe responses (404 instead of 403), Zod-strict mass-assignment defense, JWT verification against a JWKS, and mid-session suspension enforcement.
- **Deployed and running.** The REST API runs on Render against a managed MongoDB Atlas cluster. Background workers run separately from the HTTP server.
- **Tested against a real database.** 103 passing tests (25 unit, 78 integration) cover concurrency, failure injection, crash recovery, and state machines. Integration tests use real MongoDB transactions, not mocks.

## Features

| Area | What it does |
|------|--------------|
| **Canonical match results** | Versioned content catalog, match lifecycle state machine, idempotent result submission, ambiguous-commit resolution |
| **Outbox and consumers** | Lease-based claiming, exponential backoff with jitter, dead-lettering with replay, backpressure monitoring |
| **Competitive ratings** | Elo rating algorithm, tier derivation, audited rating corrections, season lifecycle |
| **Stats and economy** | Rebuildable projections, cursor-paginated leaderboards, idempotent inventory grants, progression (XP) ledger |
| **Matchmaking** | Ticket state machine, atomic allocation, partial-claim prevention, cancellation-vs-allocation race handling, allocator crash recovery |
| **Tournaments** | Immutable bracket revisions, idempotent bracket advancement |
| **Moderation and audit** | Report and sanction workflow, audit events, admin route separation |
| **Identity** | JWKS-validated JWTs, concurrent first-login safety, identity linking, account-status enforcement |
| **Operations** | Migrations, deterministic seeding, index/validator/constraint verification, graceful shutdown, runbooks |

## Architecture

Canonical truth plus event-driven projections.

```text
Client (HTTP POST)
       |
       v
[JWT Auth Middleware]
       |
       v
+-----------------------------------------------+
|  Canonical Transaction (MongoDB)              |
|  ---------------------------------            |
|  matches (status: completed)                  |
|  matchParticipants (N documents)              |
|  outboxEvents (1 MATCH_COMPLETED)             |
|  outboxDeliveries (1 per consumer)            |
|  idempotencyRecords (fingerprint)             |
+-----------------------------------------------+
       |
       v
+-----------------------------------------------+
|  Outbox Relay (lease-based claim)             |
|  ---------------------------------            |
|  Exponential backoff + jitter                 |
|  Stale-worker protection                      |
|  Dead-letter + replay script                  |
+-----------------------------------------------+
       |
       v
+-----------------------------------------------+
|  Rating Processor (atomic)                    |
|  ---------------------------------            |
|  Per-player sequence allocation               |
|  Strict ordering enforcement                  |
|  Atomic: rating + event + delivery            |
+-----------------------------------------------+
       |
       v
  competitiveRatings projection (read model)
```

### Design principles

1. **One transactional write path.** A match result, its participants, its outbox event, its per-consumer deliveries, and its idempotency record commit together or not at all.
2. **Projections are disposable.** Read models can be rebuilt from canonical data.
3. **At-least-once delivery, exactly-once effect.** The relay may redeliver; consumers are idempotent and enforce ordering.
4. **Fail closed.** Unknown fields are rejected, unauthorized access looks like absence, and ambiguous states are resolved explicitly.

### Failure model

| Failure | Behavior |
|---------|----------|
| Concurrent duplicate submission | One canonical record; others resolve through the idempotency record |
| Error inside the transaction | Full rollback, no partial state |
| Commit succeeds but the ACK is lost | Retry resolves to the committed result |
| Relay worker crashes mid-delivery | Lease expires, another worker claims; the stale worker is fenced out |
| Consumer keeps failing | Backoff with jitter, then dead-letter; replay with a script |
| Rating event arrives out of order | Gap detected; application deferred until order is restored |

## Game content catalog

The database is seeded with a full, original-IP content catalog, showing it can model rich relational game data: weapons, economy, maps, and characters. Every match is pinned to a catalog version, so results keep resolving correctly even after the catalog changes (`v2` extends `v1`). The tables below describe the `v1` catalog.

### 🗺️ Maps (10)

| Name | Size | Supported modes |
| :--- | :--- | :--- |
| **Redline** | Medium | Team Deathmatch, Bomb Defusal |
| **Caravan** | Large | Bomb Defusal, Battle Royale |
| **Glacier** | Small | Bomb Defusal, Free-for-All |
| **Emberfall** | Medium | Team Deathmatch, Bomb Defusal, Battle Royale |
| **Terrace** | Small | Free-for-All, Team Deathmatch |
| **Brine** | Large | Bomb Defusal, Battle Royale |
| **Monolith** | Medium | Bomb Defusal, Battle Royale |
| **Ashfall** | Medium | Team Deathmatch, Free-for-All |
| **Crosswinds** | Small | Free-for-All, Team Deathmatch |
| **Undertow** | Large | Bomb Defusal, Battle Royale |

### 🔫 Weapons (35)

Five weapons per category, each with its own stats (damage, fire rate, headshot multiplier).

| Category | Weapons |
| :--- | :--- |
| **Assault Rifle** | Wraith, Havoc, Sentinel, Warden, Raptor |
| **SMG** | Viper, Hornet, Bolt, Wasp, Needle |
| **Sniper** | Hammerfall, Coldshot, Railgun, Longshot, Apexbreaker |
| **LMG** | Bulwark, Avalanche, Thunderhead, Ironbell, Siegeheart |
| **Pistol** | Sidearm, Whisper, Judge, Flashpoint, Clawback |
| **Shotgun** | Thunder, Striker, Scattershot, Breaker, Bastion |
| **Melee** | Tactical Blade, Void Edge Dagger, Rift Cleaver, Ironfang, Nightreaver |

### 🧑‍🚀 Characters (25)

Five characters per role class.

| Role | Characters |
| :--- | :--- |
| **Assault** | Vandal, Ravager, Pyre, Riptide, Hawkeye |
| **Sniper** | Coldshot, Lattice, Nightfall, Talon, Vigil |
| **Controller** | Umbra, Aegisveil, Miasma, Skywarden, Duskbrand |
| **Support** | Vital, Lifeline, Mender, Symbiotic, Halo |
| **Tank** | Bulwark, Foundation, Ironhide, Anchor, Stonewall |

### 💣 Throwables and 🛡️ Equipment

- **Throwables (8):** Shattercore, Veilcloud, Blindlight, Cinderwave, Phantom Echo, Nullburst, Lifebloom, Quakejaw.
- **Equipment (13):** 3 armor levels (Light, Medium, Heavy), 3 helmet levels, 6 ammo types (one per ranged weapon class), and 1 med kit.

### 🎮 Game modes and matchmaking (2 buckets × 4 modes)

Matchmaking supports **Ranked** and **Unranked** buckets across four core modes.

| Mode | Team size | Rounds | Supported buckets |
| :--- | :--- | :--- | :--- |
| **Team Deathmatch** | 5v5 | 1 | Ranked, Unranked |
| **Free-for-All** | Solo (everyone vs everyone) | 1 | Ranked, Unranked |
| **Bomb Defusal** | 5v5 | 7 | Ranked, Unranked |
| **Battle Royale** | Solo, Duo, Trio, Squad (up to 5) | 1 | Ranked, Unranked |

## Core guarantees

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

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime | [Node.js](https://nodejs.org) (>= 20.19.0) |
| Language | [TypeScript](https://www.typescriptlang.org) (strict, no `any`) |
| HTTP server | [Express](https://expressjs.com) |
| Database | [MongoDB Atlas](https://www.mongodb.com/atlas) (replica set) |
| Validation | [Zod](https://zod.dev) (strict schemas) |
| Auth | [jose](https://github.com/panva/jose) (JWKS, JWT) |
| Testing | [Vitest](https://vitest.dev) |
| CI/CD | GitHub Actions → Render |

## Quick start

**Prerequisites:** Node.js **20.19.0+**, npm, and a MongoDB Atlas cluster. Every Atlas cluster, including the free tier, is a replica set, which multi-document transactions require.

```bash
git clone https://github.com/shaurya-10000/fps-game-database.git
cd fps-game-database
npm install
cp .env.example .env        # set MONGODB_URI to your Atlas connection string
```

Run the API locally:

```bash
npm run dev
```

The server starts on `http://localhost:3000`. Verify it:

```bash
curl http://localhost:3000/health
# {"status":"ok","env":"development"}
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the API in development mode |
| `npm run build` | Compile `src/` to `dist/` |
| `npm start` | Run the compiled API |
| `npm run start:worker` | Run the background worker (outbox relay + rating processor) |
| `npm run typecheck` | Strict typecheck, including tests |
| `npm test` | Unit tests |
| `npm run test:integration` | Integration tests against Atlas |
| `npm run ci` | What CI runs: typecheck + build + test |
| `npm run seed -- --size=small` | Seed a deterministic dataset |
| `npm run verify:validators` | Verify collection JSON Schema validators |
| `npm run verify:indexes` | Verify the index inventory matches the database |
| `npm run verify:unique` | Verify unique constraints |
| `npm run verify:explain` | Verify query plans use indexes |
| `npm run verify:backup-restore` | Verify referential integrity |
| `npm run migrate` | Run idempotent migrations (`--dry-run` supported) |
| `npm run replay:dead-letter <id>` | Replay a dead-lettered delivery |

## Testing

The repository contains 103 tests across 42 files: 25 unit tests and 78 integration tests.

```bash
npm test                  # Unit tests (fast, hermetic)
npm run test:integration  # Integration tests (requires Atlas)
```

> Integration tests need a valid `MONGODB_URI` in `.env` and run heavy concurrent operations against your Atlas cluster. Use a dedicated or disposable cluster, not data you care about.

Coverage includes concurrent duplicate submission, transaction rollback via failure injection, lost-ACK recovery, worker crash recovery, sequence ordering, matchmaking races, bracket idempotency, and authorization boundaries.

## Deployment

### Render (API)

The API runs as a Web Service on Render.

1. Build command: `npm install --include=dev && npm run build`
2. Start command: `npm start`
3. Environment variables: `MONGODB_URI`, `NODE_ENV=production`, `AUTH_JWKS_URI`, `AUTH_ISSUER`, `AUTH_AUDIENCE`

If the instance has been idle, the first request to the live health check may take a while to respond.

### Background worker (outbox relay)

By design, the HTTP server only handles canonical writes. Projection workers (`OutboxRelay`, `RatingProcessor`) run as a separate, continuous process. To process ratings in a deployment, run a Render **Background Worker** with:

```bash
npm run start:worker
```

## Operations and documentation

| Document | Purpose |
|----------|---------|
| [`threat-model.md`](docs/threat-model/threat-model.md) | Security boundaries and accepted risks |
| [`security-review.md`](docs/security/security-review.md) | OWASP API Top 10 coverage |
| [`index-inventory.md`](docs/architecture/index-inventory.md) | Every index, justified |
| [`statistics-definitions.md`](docs/architecture/statistics-definitions.md) | Stat calculation rules |
| [`match-pipeline-trace.md`](docs/operations/match-pipeline-trace.md) | End-to-end trace of one match |
| [`slo.md`](docs/operations/slo.md) | Service level objectives |
| [`load-test-results.md`](docs/operations/load-test-results.md) | Load test results and method |
| [`backup-restore-drill.md`](docs/operations/backup-restore-drill.md) | Restore drill record |
| [`sample-logs.md`](docs/operations/sample-logs.md) | Structured log format |
| [`runbooks/`](docs/operations/runbooks/) | Incident response |

## Security

- JWTs are verified against a JWKS with issuer, audience, and expiry checks.
- Unauthorized access to another player's resources returns 404, not 403, to avoid leaking existence.
- Request bodies use strict schemas (unknown fields rejected), with matching validators at the database layer.
- High-risk routes re-check account status, so suspensions apply mid-session.
- Admin routes are separated and audited.

To report a vulnerability, please use GitHub's private vulnerability reporting on this repository rather than a public issue.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "Transaction numbers are only allowed on a replica set member" | MongoDB running standalone | Use MongoDB Atlas (replica set by default) |
| Integration tests fail to connect | Wrong or missing `MONGODB_URI` | Check `.env` against `.env.example`; allow your IP in Atlas network access |
| `npm install` fails on engine check | Node older than 20.19.0 | Upgrade Node |
| `verify:indexes` reports drift | Migration not applied | Run `npm run migrate`, then re-verify |
| Ratings never update in a deployment | Worker not running | Start the background worker (`npm run start:worker`) |
| Deliveries stuck in dead-letter | Persistent consumer failure | Fix the root cause, then `npm run replay:dead-letter <id>` |

## License

Released under the MIT license. See [LICENSE](./LICENSE).

---

<div align="center">

Built by [shaurya-10000](https://github.com/shaurya-10000) · [Report a bug](https://github.com/shaurya-10000/fps-game-database/issues)

</div>