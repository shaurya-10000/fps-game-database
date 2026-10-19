# End-to-End Trace: One Match

This document traces a single match from canonical acceptance through to a player's rating update.

## Flow
1. **`POST /internal/matches/:id/result`** -> Validates idempotency key.
2. **Canonical Transaction** -> Commits `matches` (status=completed), `matchParticipants`, `outboxEvents`, `outboxDeliveries` (one per consumer).
3. **Outbox Relay Worker** -> Claims `outboxDeliveries` row via `findOneAndUpdate`.
4. **Rating Consumer** -> Reads sequence from the `RatingSequence` doc, verifies `lastAppliedSequence + 1`.
5. **Rating Processor** -> Atomically updates `competitiveRatings` projection, inserts `ratingEvents`, completes the delivery.
6. **`GET /players/me/rating`** -> Reads from `competitiveRatings` projection.

## Latency Budget (per hop)
- **Canonical transaction**: < 50ms (local) / < 150ms (Atlas)
- **Outbox claim + processing**: < 30ms
- **Projection update**: < 20ms
- **End-to-end (match accept -> rating visible)**: < 300ms

## State at Each Hop

| Hop | Collection | State |
|-----|-----------|-------|
| 1 | `matches` | `status: in_progress` -> `status: completed` |
| 2 | `matchParticipants` | 2 rows inserted (one per player) |
| 3 | `outboxEvents` | 1 row (`MATCH_COMPLETED`) |
| 4 | `outboxDeliveries` | 3 rows (`rating`, `progression`, `statistics`), all `status: pending` |
| 5 | `competitiveRatings` | `rating: 1000` -> `rating: 1025`, `lastAppliedSequence: 1` |
| 6 | `outboxDeliveries` (rating row) | `status: completed` |

## Verification
Verified by reading the code paths in:
- `src/domain/matches/canonical-service.ts`
- `src/infrastructure/outbox/relay.ts`
- `src/domain/matches/rating-processor.ts`
