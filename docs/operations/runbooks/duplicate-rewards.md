# Runbook: Duplicate Rewards

## Symptom
Player received duplicate inventory items or XP.

## Diagnosis
1. Query inventoryItems for duplicates on {playerId, definitionId, sourceEventId}.
2. Query progressionEvents for duplicates on {playerId, sourceEventId}.

## Resolution
1. If duplication exists, the unique index was bypassed (investigate DB drift).
2. Apply compensating negative reward via progressionService.awardXp.
3. File a severity-1 incident report.

## Last tested
2026-10-19
