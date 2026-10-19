# Runbook: Compromised Credentials

## Symptom
Suspicious login activity or leaked token reported.

## Immediate Actions
1. Rotate AUTH_JWKS_URI signing keys via the IdP console.
2. Sanction the player: moderation.applySanction(playerId, "suspend", "compromised credentials", operatorId).
3. Audit auditEvents for last 24h.

## Last tested
Not yet exercised. Documented procedure.
