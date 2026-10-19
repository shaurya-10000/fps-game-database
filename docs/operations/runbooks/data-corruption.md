# Runbook: Data Corruption

## Diagnosis
1. npm run verify:backup-restore (referential integrity).
2. npm run verify:indexes (missing/drifted indexes).
3. Query for orphaned records.

## Resolution
1. Stop outbox relay workers.
2. npm run migrate
3. scripts/rebuild-projections.ts
4. Restart relay workers.

## Last tested
Not yet exercised in production. Documented procedure.
