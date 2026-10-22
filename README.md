<div align="center">

# 🎮 FPS Game Database

**A cloud-deployed backend and web dashboard for competitive FPS games.**

Canonical match recording, transactional outbox, sequence-ordered Elo ratings, matchmaking, tournaments, moderation, real-time communications (chat, group chats, friends, WebRTC calls), and mode-aware XP progression, built so every match result is recorded once and only once, even when networks and workers fail.

[![CI](https://github.com/shaurya-10000/fps-game-database/actions/workflows/ci.yml/badge.svg)](https://github.com/shaurya-10000/fps-game-database/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.19+-green?logo=node.js)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://www.mongodb.com/atlas)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.0+-black?logo=socket.io)](https://socket.io)
[![Next.js](https://img.shields.io/badge/Dashboard-Next.js_16-black?logo=nextdotjs)](#web-dashboard)

[**Live API Health Check**](https://fps-game-database.onrender.com/health) · [**Report a bug**](https://github.com/shaurya-10000/fps-game-database/issues)

</div>

---

## Contents

- [Highlights](#highlights)
- [Features](#features)
- [Web dashboard](#web-dashboard)
- [Architecture](#architecture)
- [Chat API and socket events](#chat-api-and-socket-events)
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
- **Real-time communications.** Socket.io handles authenticated, bi-directional WebSocket connections for Global, Region, Group, and DM chat, and acts as a signaling relay for peer-to-peer WebRTC voice and video calls.
- **Full-featured chat.** Group chats with admins, replies, reactions, edit and delete, pinned messages, server-side search, and paged history, with membership enforced on every room.
- **Web dashboard.** A Next.js dashboard puts the whole platform in a browser: catalog, rankings, profile and progression, friends, chat, group chats, and voice and video calls.
- **Mode-aware progression.** The XP engine calculates rewards contextually: K/D matters in Team Deathmatch, survival time matters in Battle Royale, and the leveling curve gets progressively harder as players rank up.
- **Strict ordering.** Per-player rating sequences are enforced atomically. Out-of-order events are deferred, duplicates are no-ops, and gaps block application until resolved.
- **Security by design.** BOLA-safe responses (404 instead of 403), Zod-strict mass-assignment defense, JWT verification against a JWKS, socket-level JWT authentication, room-level access checks, and mid-session suspension enforcement.
- **Typed game content model.** Maps, weapons with full ballistics, characters, throwables, equipment, and game modes are strictly typed TypeScript domain models, seeded into versioned catalogs that matches pin to.
- **Deployed and running.** The REST API and WebSocket server run on Render against a managed MongoDB Atlas cluster. Background workers run separately from the HTTP server.
- **Tested against a real database.** 106 passing tests (24 unit, 82 integration) cover concurrency, failure injection, crash recovery, social graph race conditions, and state machines. Integration tests use real MongoDB transactions, not mocks.

## Features

| Area | What it does |
| :--- | :--- |
| **Canonical match results** | Versioned content catalog, match lifecycle state machine, idempotent result submission, ambiguous-commit resolution |
| **Outbox and consumers** | Lease-based claiming, exponential backoff with jitter, dead-lettering with replay, backpressure monitoring |
| **Competitive ratings** | Elo rating algorithm, tier derivation, audited rating corrections, season lifecycle |
| **Progression and XP** | Mode-aware XP calculation, progressive leveling curve, transaction-safe multi-level-ups |
| **Stats and economy** | Rebuildable projections, cursor-paginated leaderboards, idempotent inventory grants, progression (XP) ledger |
| **Matchmaking** | Ticket state machine, atomic allocation, partial-claim prevention, cancellation-vs-allocation race handling, allocator crash recovery |
| **Tournaments** | Immutable bracket revisions, idempotent bracket advancement |
| **Moderation and audit** | Report and sanction workflow, audit events, admin route separation |
| **Social graph** | Friendships with mutual auto-accept, directional blocking (dominant over friendships), BOLA-safe error surfaces, in-flight request caps |
| **Real-time chat** | Authenticated WebSocket connections via Socket.io. Global and Region rooms, deterministic Direct Messages (DMs), live updates for edits, deletes, reactions, and pins |
| **Group chats** | Create from friends, rename, add and remove members, leave. Creator is admin, admin role is handed on when the last admin leaves. System notices for membership changes |
| **Message features** | Replies with quoted previews, 8 fixed reactions, edit, delete for everyone, pinned messages (50 per room), server-side search, paged history, voice messages |
| **WebRTC signaling** | Backend relay for peer-to-peer voice and video calls. Handles Offer, Answer, ICE candidate exchange, and call termination |
| **Content catalog** | Versioned, typed catalog of maps, weapons (with ballistics), characters, throwables, equipment, and game modes; every match pins to a catalog version |
| **Identity** | JWKS-validated JWTs, concurrent first-login safety, identity linking, account-status enforcement |
| **Web dashboard** | Next.js app for the catalog, rankings, profile, friends, chat, group chats, and calls |
| **Operations** | Migrations, deterministic seeding, index/validator/constraint verification, graceful shutdown, runbooks |

## Web dashboard

The dashboard is a Next.js app that talks to this API and its WebSocket server. It is developed as its own project (`frontend`) and needs this backend running.

<!-- Add screenshots here once captured, for example:
<p align="center"><img src="docs/images/dashboard-dms.png" alt="Direct messages" width="860" /></p>
-->

| Area | What you can do |
| :--- | :--- |
| **Catalog** | Browse weapons (with full ballistics), maps, characters, equipment, throwables, and game modes |
| **Rankings** | Read the cursor-paginated leaderboard |
| **Profile** | See your level and XP progress, friend count, and edit your display name, username, and email |
| **Friends** | Manage friends, requests, and blocks |
| **Global chat** | Join the global room with voice messages |
| **Direct messages** | Search and pin chats, reply, react, edit, delete, pin messages, search history, send voice messages and emoji, with optimistic sending and retry |
| **Group chats** | Create groups from your friends, rename them, manage members, and leave |
| **Calls** | Voice and video calls with pre-answer setup (mic, camera, screen share), a device menu, ringtones, and reconnect handling |

### Running the dashboard

From the dashboard project folder (`frontend`):

```bash
npm install
cp .env.local.example .env.local   # then set the values below
npm run dev
```

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Yes | Base URL of this API and its WebSocket server (default `http://localhost:3000`) |
| `MONGODB_URI` | Yes | Atlas connection string for the server-rendered catalog and ranking pages |
| `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL` | No | TURN relay so calls work across strict networks |

> [!WARNING]
> `.env.local` contains your database connection string. Keep it git-ignored and never commit it.

### Calls

Calls are peer-to-peer WebRTC; this API only relays the signaling. While a call is ringing you can set up your microphone, camera, and screen share before you answer. During a call you can switch microphone, camera, and speaker (speaker choice needs a Chromium-based browser), share your screen, go fullscreen, and use the keyboard: `M` mute, `V` camera, `S` share screen, `F` fullscreen, `Enter` accept. Incoming calls ring on every dashboard page. Group calls are not supported.

## Architecture

Canonical truth, event-driven projections, and real-time communications.

```mermaid
flowchart TD
    C["Clients<br/>(Dashboard, HTTP POST / WebSocket)"] --> A["JWT auth middleware<br/>Socket.io middleware"]

    A --> T["Canonical transaction (MongoDB)<br/>matches, matchParticipants, outboxEvents,<br/>outboxDeliveries, idempotencyRecords"]
    A --> R["Real-time chat (Socket.io)<br/>chatRooms, chatMessages,<br/>WebRTC signaling relay"]

    R -.-> P2P["Peer-to-peer audio / video"]

    T --> O["Outbox relay<br/>lease-based claim, backoff + jitter,<br/>stale-worker fencing, dead-letter + replay"]
    O --> RP["Consumers (atomic)<br/>Rating processor (Elo)<br/>Progression (XP engine)<br/>Statistics"]
    RP --> V[("Read models<br/>competitiveRatings<br/>progressionProfiles")]
```

<details>
<summary>Plain-text version of the diagram</summary>

```text
Clients (Dashboard, HTTP POST / WebSocket)
       |
       v
[JWT Auth Middleware / Socket.io Middleware]
       |
       +---------------------------------------+
       |                                       |
       v                                       v
+---------------------------------------+  +---------------------------------------+
|  Canonical Transaction (MongoDB)      |  |  Real-time Chat (Socket.io)           |
|  ---------------------------------    |  |  ---------------------------------    |
|  matches (status: completed)          |  |  chatRooms (global, region, group)    |
|  matchParticipants (N documents)      |  |  chatMessages (indexed by room/time)  |
|  outboxEvents (1 MATCH_COMPLETED)     |  |  WebRTC Signaling (P2P relay)         |
|  outboxDeliveries (1 per consumer)    |  +---------------------------------------+
|  idempotencyRecords (fingerprint)     |                      |
+---------------------------------------+                      v
       |                                             Peer-to-Peer Audio/Video
       v
+---------------------------------------+
|  Outbox Relay (lease-based claim)     |
|  ---------------------------------    |
|  Exponential backoff + jitter         |
|  Stale-worker protection              |
|  Dead-letter + replay script          |
+---------------------------------------+
       |
       v
+---------------------------------------+
|  Consumers (atomic)                   |
|  ---------------------------------    |
|  Rating Processor (Elo)               |
|  Progression (XP Engine)              |
|  Statistics                           |
+---------------------------------------+
       |
       v
  competitiveRatings, progressionProfiles
  (read models)
```

</details>

### Design principles

1. **One transactional write path.** A match result, its participants, its outbox event, its per-consumer deliveries, and its idempotency record commit together or not at all.
2. **Real-time is stateless.** Chat messages are persisted, but WebRTC call signaling is relayed in-memory for maximum speed and minimal database load.
3. **Projections are disposable.** Read models can be rebuilt from canonical data.
4. **At-least-once delivery, exactly-once effect.** The relay may redeliver; consumers are idempotent and enforce ordering.
5. **Fail closed.** Unknown fields are rejected, unauthorized access looks like absence, and ambiguous states are resolved explicitly.

### Failure model

| Failure | Behavior |
| :--- | :--- |
| Concurrent duplicate submission | One canonical record; others resolve through the idempotency record |
| Error inside the transaction | Full rollback, no partial state |
| Commit succeeds but the ACK is lost | Retry resolves to the committed result |
| Relay worker crashes mid-delivery | Lease expires, another worker claims; the stale worker is fenced out |
| Consumer keeps failing | Backoff with jitter, then dead-letter; replay with a script |
| Rating event arrives out of order | Gap detected; application deferred until order is restored |
| Concurrent friend accept | Unique index on reverse direction ensures exactly one pair is created |
| Socket connection drops | Client auto-reconnects via Socket.io, re-authenticates, and rejoins rooms |
| WebRTC target offline | Signaling event is dropped; client times out waiting for Answer |
| Player levels up multiple times in one match | Transaction-safe loop applies levels until the XP is spent |
| Member removed from a group | Their live sockets leave the room immediately, so no further messages are delivered |

## Chat API and socket events

All routes are authenticated. Rooms are checked on every read and write: DM rooms belong to their two participants, group rooms to their members, Global and Region rooms are open.

### REST

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/chat/dm-by-id/:playerId` | Get or create the DM room with a friend |
| `GET` | `/api/chat/groups` | List the groups you belong to, with members |
| `POST` | `/api/chat/groups` | Create a group from friends: `{ name, memberIds }` |
| `GET` | `/api/chat/groups/:roomId` | Group details and members |
| `PATCH` | `/api/chat/groups/:roomId` | Rename (admin): `{ name }` |
| `POST` | `/api/chat/groups/:roomId/members` | Add friends: `{ memberIds }` |
| `DELETE` | `/api/chat/groups/:roomId/members/:playerId` | Remove a member (admin), or leave (yourself) |
| `GET` | `/api/chat/rooms/:roomId/history` | Older messages: `?before=<ISO>&limit=` (max 100) |
| `GET` | `/api/chat/rooms/:roomId/search` | Search messages: `?q=` (2 to 100 characters) |
| `GET` | `/api/chat/rooms/:roomId/pins` | Pinned messages |
| `POST` / `DELETE` | `/api/chat/rooms/:roomId/messages/:messageId/pin` | Pin or unpin (max 50 per room) |
| `PATCH` | `/api/chat/rooms/:roomId/messages/:messageId` | Edit your own text message: `{ content }` |
| `DELETE` | `/api/chat/rooms/:roomId/messages/:messageId` | Delete for everyone (author, or group admin) |
| `POST` | `/api/chat/rooms/:roomId/messages/:messageId/reactions` | Toggle a reaction: `{ emoji }` (fixed set of 8) |
| `POST` | `/api/chat/rooms/:roomId/voice` | Upload a voice message (multipart) |

### Socket events

| Direction | Event | Payload |
| :--- | :--- | :--- |
| Client to server | `join_room` | `roomId` |
| Client to server | `send_message` | `{ roomId, content, replyToId? }` (max 2000 characters, rate limited to 20 per 10 seconds) |
| Server to client | `room_history` | Latest 50 messages, oldest first |
| Server to client | `new_message` | Message, including system notices |
| Server to client | `message_edited` / `message_deleted` | `{ roomId, messageId, ... }` |
| Server to client | `message_reactions` | `{ roomId, messageId, reactions }` |
| Server to client | `message_pinned` / `message_unpinned` | `{ roomId, messageId, pinned? }` |
| Server to client | `group_updated` | `{ roomId }`, sent to current and removed members |
| Server to client | `error` | Human-readable string |
| Client to server | `call_user`, `answer_call`, `ice_candidate`, `end_call` | WebRTC signaling payloads with `targetPlayerId` |
| Server to client | `incoming_call`, `call_answered`, `ice_candidate`, `call_ended` | The same payloads, tagged with `fromPlayerId` |

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

Five weapons per category. Every weapon carries a full ballistics profile, not just a damage number.

| Stat | Meaning |
| :--- | :--- |
| `damage`, `minDamage` | Body damage up close, and the floor reached at long range |
| `falloffStartMeters`, `falloffEndMeters` | Where damage starts dropping and where it reaches `minDamage` |
| `rangeMeters` | Maximum effective range |
| `fireRate`, `isAutomatic` | Rounds per minute, and whether the weapon fires automatically |
| `magazineSize`, `reloadTimeMs` | Ammo capacity and reload duration |
| `headshotMultiplier` | Damage multiplier on headshots |
| `recoilVertical`, `recoilHorizontal` | Recoil kick in degrees |
| `spread` | Base inaccuracy in degrees |
| `penetration` | 0 none, 1 low, 2 medium, 3 high |

One representative weapon per category (full data lives in `src/domain/catalog/data.ts`):

| Weapon | Type | Damage (min) | RPM | Mag | Reload | HS × | Range (falloff) | Recoil V/H | Spread | Pen |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Wraith** | Assault Rifle | 36 (28) | 600 | 30 | 2.5s | 4.0 | 50m (20-40m) | 2.5 / 1.2 | 0.5 | 2 |
| **Viper** | SMG | 27 (18) | 750 | 30 | 2.8s | 4.0 | 30m (10-25m) | 1.5 / 1.8 | 0.8 | 1 |
| **Hammerfall** | Sniper | 115 (115) | 41 | 10 | 3.7s | 4.0 | 100m (no falloff) | 8.0 / 2.0 | 0.1 | 3 |
| **Bulwark** | LMG | 35 (28) | 800 | 150 | 5.5s | 4.0 | 60m (30-55m) | 3.5 / 2.5 | 1.5 | 3 |
| **Judge** | Pistol | 63 (48) | 267 | 7 | 2.2s | 4.0 | 25m (10-20m) | 2.5 / 1.0 | 0.6 | 2 |
| **Thunder** | Shotgun | 26 (8) | 85 | 8 | 2.6s | 3.0 | 15m (5-12m) | 4.0 / 1.5 | 3.0 | 1 |
| **Tactical Blade** | Melee | 55 (55) | 120 | n/a | n/a | n/a | 2m | none | 0 | 0 |

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

Matchmaking supports **Ranked** and **Unranked** buckets across four core modes. XP is calculated contextually depending on the mode.

| Mode | Team size | Rounds | XP priority |
| :--- | :--- | :--- | :--- |
| **Team Deathmatch** | 5v5 | 1 | Kills, damage dealt, fewer deaths |
| **Free-for-All** | Solo (everyone vs everyone) | 1 | Kills, damage dealt, fewer deaths |
| **Bomb Defusal** | 5v5 | 7 | Kills, objective score |
| **Battle Royale** | Solo, Duo, Trio, Squad (up to 5) | 1 | Survival time, kills |

### Content model

The catalog is a strictly typed domain model. Weapon stats, for example:

```ts
export interface WeaponStats {
  damage: number;
  fireRate: number;            // rounds per minute
  magazineSize: number;
  reloadTimeMs: number;
  headshotMultiplier: number;
  rangeMeters: number;
  falloffStartMeters: number;
  falloffEndMeters: number;
  minDamage: number;
  recoilVertical: number;      // degrees
  recoilHorizontal: number;    // degrees
  spread: number;              // degrees
  penetration: number;         // 0-3
  isAutomatic: boolean;
}
```

Weapon types, throwable types, character roles, game modes, and matchmaking buckets are closed union types, so an invalid value fails at compile time rather than at runtime. Seed the catalog with `npm run seed:catalog`.

## Core guarantees

| Guarantee | How it is proven |
| :--- | :--- |
| Zero duplicate canonical records under concurrent submission | 20-parallel test (`duplicate-load.test.ts`) |
| Full transaction rollback on any failure point | Failure injection (`canonical-result.test.ts`) |
| Ambiguous commit resolution (network drops ACK) | `ambiguous-commit.test.ts` |
| Exactly-once rating across crashes and retries | Worker crash recovery test |
| No out-of-order application | Sequence gap detection test |
| BOLA protection (404, not 403, on unauthorized) | `auth-middleware.test.ts` |
| Mass-assignment rejection at DB and API layer | Zod `.strict()` + `additionalProperties: false` |
| Mid-session account suspension enforcement | High-risk route re-check test |
| Exactly-once friendship creation under concurrent accept | `friends.test.ts` |
| Block prevents future requests in both directions | `friends.test.ts` |

## Tech stack

### Backend and data

<p>
  <img src="https://img.shields.io/badge/Node.js-20.19+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MongoDB_Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB Atlas" />
  <img src="https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white" alt="Zod" />
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT" />
</p>

### Real-time and media

<p>
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white" alt="WebRTC" />
</p>

### Dashboard

<p>
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white" alt="Framer Motion" />
  <img src="https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/Lucide-F56565?style=for-the-badge&logo=lucide&logoColor=white" alt="Lucide" />
  <img src="https://img.shields.io/badge/Socket.io_Client-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io client" />
  <img src="https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white" alt="ESLint" />
</p>

### Testing, CI and hosting

<p>
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="GitHub Actions" />
  <img src="https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=black" alt="Render" />
</p>

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

To use the dashboard against it, see [Web dashboard](#web-dashboard).

## Scripts

| Script | Purpose |
| :--- | :--- |
| `npm run dev` | Start the API in development mode |
| `npm run build` | Compile `src/` to `dist/` |
| `npm start` | Run the compiled API |
| `npm run start:worker` | Run the background worker (outbox relay, rating processor, progression) |
| `npm run typecheck` | Strict typecheck, including tests |
| `npm test` | Unit tests |
| `npm run test:integration` | Integration tests against Atlas |
| `npm run ci` | What CI runs: typecheck + build + test |
| `npm run seed -- --size=small` | Seed a deterministic dataset |
| `npm run seed:catalog` | Seed the versioned content catalog |
| `npm run verify:validators` | Verify collection JSON Schema validators |
| `npm run verify:indexes` | Verify the index inventory matches the database |
| `npm run verify:unique` | Verify unique constraints |
| `npm run verify:explain` | Verify query plans use indexes |
| `npm run verify:backup-restore` | Verify referential integrity |
| `npm run migrate` | Run idempotent migrations (`--dry-run` supported) |
| `npm run replay:dead-letter <id>` | Replay a dead-lettered delivery |

## Testing

The repository contains 106 tests across 42 files: 24 unit tests and 82 integration tests.

```bash
npm test                  # Unit tests (fast, hermetic)
npm run test:integration  # Integration tests (requires Atlas)
```

> [!WARNING]
> Integration tests need a valid `MONGODB_URI` in `.env` and run heavy concurrent operations against your Atlas cluster. Use a dedicated or disposable cluster, not data you care about.

Catalog tests assert exact content counts (10 maps, 35 weapons, 25 characters, 8 throwables, 13 equipment items, 4 game modes), five weapons per type, five characters per role, complete ballistics on every weapon, and game-mode rules such as the 7-round 5v5 Bomb Defusal.

Coverage includes concurrent duplicate submission, transaction rollback via failure injection, lost-ACK recovery, worker crash recovery, sequence ordering, matchmaking races, bracket idempotency, concurrent friend accept, directional blocking, and authorization boundaries.

## Deployment

### Render (API)

The API runs as a Web Service on Render.

1. Build command: `npm install --include=dev && npm run build`
2. Start command: `npm start`
3. Environment variables: `MONGODB_URI`, `NODE_ENV=production`, `AUTH_JWKS_URI`, `AUTH_ISSUER`, `AUTH_AUDIENCE`

> [!NOTE]
> If the instance has been idle, the first request to the live health check may take a while to respond.

On the first start after upgrading to the group chat release, the server replaces the old unique `{ type, name }` index on `chatRooms` with one that only covers Global and Region rooms, so several groups can share a name. No manual migration is needed.

### Background worker (outbox relay)

By design, the HTTP server only handles canonical writes. Projection workers (`OutboxRelay`, `RatingProcessor`, `ProgressionService`) run as a separate, continuous process. To process ratings and progression in a deployment, run a Render **Background Worker** with:

```bash
npm run start:worker
```

## Operations and documentation

| Document | Purpose |
| :--- | :--- |
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
- WebSocket connections are authenticated using the same JWT middleware as HTTP.
- Chat rooms are access-checked on every join, send, history, search, pin, edit, delete, reaction, and voice upload: DM rooms belong to their two participants and group rooms to their members.
- Message sending is rate limited per connection, and reactions are restricted to a fixed set so arbitrary text never becomes a database key.
- Unauthorized access to another player's resources returns 404, not 403, to avoid leaking existence.
- Blocking a player hides your presence from them and prevents future friend requests or DMs.
- Request bodies use strict schemas (unknown fields rejected), with matching validators at the database layer.
- High-risk routes re-check account status, so suspensions apply mid-session.
- Admin routes are separated and audited.

To report a vulnerability, please use GitHub's private vulnerability reporting on this repository rather than a public issue.

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| "Transaction numbers are only allowed on a replica set member" | MongoDB running standalone | Use MongoDB Atlas (replica set by default) |
| Integration tests fail to connect | Wrong or missing `MONGODB_URI` | Check `.env` against `.env.example`; allow your IP in Atlas network access |
| `npm install` fails on engine check | Node older than 20.19.0 | Upgrade Node |
| `verify:indexes` reports drift | Migration not applied | Run `npm run migrate`, then re-verify |
| Ratings or XP never update in a deployment | Worker not running | Start the background worker (`npm run start:worker`) |
| Deliveries stuck in dead-letter | Persistent consumer failure | Fix the root cause, then `npm run replay:dead-letter <id>` |
| Chat connects but no messages appear | Client not emitting `join_room` | Ensure the client joins `global_chat` or the correct DM room ID |
| Joining a room returns "Unauthorized" | You are not a participant or member | Open the DM through `/api/chat/dm-by-id/:playerId`, or ask to be added to the group |
| Creating a second group with the same name fails | Old unique index still present | Restart the API once so it can replace the index |
| WebRTC call fails to connect | STUN/TURN server unreachable | Check client ICE configuration; ensure both peers are online |
| Calls work on one network but not across networks | No TURN relay configured | Provide a TURN server in the dashboard's `NEXT_PUBLIC_TURN_*` settings |

## License

Released under the MIT license. See [LICENSE](./LICENSE).

---

<div align="center">

Built by [shaurya-10000](https://github.com/shaurya-10000) · [Report a bug](https://github.com/shaurya-10000/fps-game-database/issues)

</div>