# Runbook: Dead-Letter Replay

## Diagnosis
1. Find delivery ID from the alert log.
2. db.outboxDeliveries.findOne({ _id: "<deliveryId>" })
3. Read lastError.

## Resolution
1. Fix root cause.
2. npm run replay:dead-letter <deliveryId>
3. Monitor: pending -> processing -> completed.

## Last tested
2026-10-19 (verified by outbox-deadletter-sequence.test.ts)
