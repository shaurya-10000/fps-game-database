# Runbook: Service Outage

## Immediate Actions
1. Check Atlas status and network connectivity.
2. npm run typecheck (env drift).
3. npm run verify:backup-restore (DB connectivity).

## If DB is down
Restart app once DB healthy. Consumers resume from outboxDeliveries (no data loss).

## If app is down
Restart. Verify workers reclaim leases (30s). Dead-lettered deliveries safe; replay with npm run replay:dead-letter <id>.

## Last tested
Not yet exercised. Documented procedure.
