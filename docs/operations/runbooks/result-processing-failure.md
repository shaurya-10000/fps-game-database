# Runbook: Result-Processing Failure

## Symptom
Match results are submitted but never appear in projections.

## Diagnosis
1. Check outboxDeliveries for stuck pending rows:
   db.outboxDeliveries.find({ status: "pending", availableAt: { $lt: new Date(Date.now() - 60000) } })
2. Check outboxDeliveries for dead_letter rows.
3. Check worker logs for LEASE_LOST or Gap detected.

## Resolution
1. If dead-letter: run npm run replay:dead-letter <deliveryId>
2. If worker crashed: Restart worker process; leases will be reclaimed automatically.
3. If gap: Identify the missing sequence and submit the missing event.

## Last tested
2026-10-19
