# Index Inventory

This document defines the exact indexes required for the FPS Game Database.
Every index must map to a specific query, have a justifiable write cost, and
include a removal condition if the query changes.

`scripts/verify-indexes.ts` must stay in sync with this table. Any index not
listed here will cause that script to fail with "Rogue index found", and any
index listed here must be created by that script.

| Collection | Index Spec | Unique | Query ID | Selectivity Estimate | Write Cost Note | Removal Condition |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `players` | `{ displayName: 1 }` | yes | `updateProfile` uniqueness | Unique (100%) | Low: display name changes are rare. | If display names become non-unique by design. |
| `playerIdentities` | `{ provider: 1, providerId: 1 }` | yes | `findIdentity`, `resolvePlayer` | Unique (100%) | Written once on account link. Low frequency. | Never. |
| `playerIdentities` | `{ playerId: 1 }` | no | `getPlayerIdentities` | High (1 to N) | Low frequency. | Never. |
| `matches` | `{ status: 1, createdAt: -1 }` | no | `getRecentMatches` | Medium (10% active) | High write volume on match completion. | If match history UI changes to query by player only. |
| `matchParticipants` | `{ matchId: 1, playerId: 1 }` | yes | `insertParticipants`, duplicate protection | Unique (100%) | 2-10 writes per match. Low. | Never. |
| `matchParticipants` | `{ playerId: 1, createdAt: -1 }` | no | `getPlayerMatchHistory` (see `explain-player-history.json`) | High (1 to N) | Low frequency reads. | If history UI stops sorting by recency. |
| `idempotencyRecords` | `{ scope: 1, key: 1 }` | yes | `checkIdempotency` | Unique (100%) | One write per accepted request. | Never. |
| `outboxDeliveries` | `{ status: 1, availableAt: 1 }` | no | `claimDelivery`, `getQueueMetrics` | Medium | High write volume on relay throughput. | If the relay switches to a different claim query. |
| `outboxDeliveries` | `{ status: 1, leaseUntil: 1 }` | no | stale-lease reclaim | Medium | Same write volume as above. | If lease semantics are removed. |
| `outboxDeliveries` | `{ createdAt: 1 }` | no | `getQueueMetrics` oldest-pending | Low | Same write volume. | If monitoring stops reporting age. |
| `competitiveRatings` | `{ rating: -1, _id: 1 }` | no | `getLeaderboardPage` cursor pagination | High | One update per rating event. | If leaderboard switches to a precomputed snapshot. |
| `inventoryItems` | `{ playerId: 1, definitionId: 1, sourceEventId: 1 }` | yes | `grantItem` idempotency | Unique (100%) | One write per grant. Low. | Never. |
| `progressionEvents` | `{ playerId: 1, sourceEventId: 1 }` | yes | `awardXp` idempotency | Unique (100%) | One write per XP grant. | Never. |