<div align="center">

  # 🎮 FPS Game Database

  **A production-grade, cloud-deployed backend for competitive FPS games.**

  Canonical match recording, transactional outbox, sequence-ordered Elo ratings, matchmaking, and moderation. Built for exactly-once data integrity, even under extreme network failure.

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
- [Architecture](#architecture)
- [Core Guarantees](#core-guarantees)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Testing](#testing)
- [Deployment](#deployment)
- [License](#license)

## Highlights

- **Exactly-once semantics.** Match results are recorded precisely once, even if clients retry, networks drop ACKs, or workers crash mid-flight.
- **Event-driven projections.** Ratings, XP, and leaderboards are derived asynchronously via a transactional outbox pattern. They can be rebuilt from scratch without touching canonical data.
- **Strict ordering.** Per-player rating sequences are enforced atomically. Out-of-order events are deferred, duplicates are no-ops, and gaps block application until resolved.
- **Zero-trust by design.** BOLA-safe responses (404 instead of 403), Zod-strict mass-assignment defense, and mid-session suspension enforcement.
- **Fully deployed and secured.** The REST API is live on Render, connected to a managed MongoDB Atlas cluster, and guarded by JWT middleware.
- **Battle-tested.** 92 passing tests (unit + integration) validating concurrency, failure injection, and state machines.

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

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime | [Node.js](https://nodejs.org) (>= 20.19.0) |
| Language | [TypeScript](https://www.typescriptlang.org) (strict, no `any`) |
| HTTP Server | [Express](https://expressjs.com) |
| Database | [MongoDB Atlas](https://www.mongodb.com/atlas) (Replica Set) |
| Validation | [Zod](https://zod.dev) (strict schemas) |
| Auth | [jose](https://github.com/panva/jose) (JWKS, JWT) |
| Testing | [Vitest](https://vitest.dev) |
| CI/CD | GitHub Actions → Render |

## Quick start

**Prerequisites:** Node.js **20.19.0+**, npm, and a MongoDB Atlas cluster (replica set).

```bash
git clone https://github.com/shaurya-10000/fps-game-database.git
cd fps-game-database
npm install
cp .env.example .env        # Add your Atlas URI
```

To run the API locally:
```bash
npm run dev
```
The server will start on `http://localhost:3000`. Verify it works:
```bash
curl http://localhost:3000/health
# Output: {"status":"ok","env":"development"}
```

## Testing

The repository contains 92 tests split between pure logic and database integration.

```bash
npm test                 # Unit tests (fast, hermetic)
npm run test:integration # Integration tests (requires Atlas)
```

*(Note: Integration tests require a valid `MONGODB_URI` in your `.env` file and will run heavy concurrent operations against your Atlas cluster).*

## Deployment

### Render (Production)

The API is currently deployed as a Web Service on Render.
1. Build Command: `npm install --include=dev && npm run build`
2. Start Command: `npm start`
3. Environment Variables: `MONGODB_URI`, `NODE_ENV=production`, `AUTH_JWKS_URI`, `AUTH_ISSUER`, `AUTH_AUDIENCE`.

### Background Workers (Outbox Relay)

By design, the HTTP server only handles canonical writes. The projection workers (`OutboxRelay`, `RatingProcessor`) are designed to run as a continuous background daemon.
To process ratings in production, deploy a separate Render **Background Worker** (Starter plan) using the command: `npm run start:worker`.

## License

Released under the MIT license. See [LICENSE](./LICENSE).

---

<div align="center">

Built by [shaurya-10000](https://github.com/shaurya-10000)

</div>