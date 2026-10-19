# Threat Model — FPS Game Database

## 1. Identity & Authentication
- **Threat:** Token forgery or replay.
- **Mitigation:** JWKS validation with issuer, audience, expiry checks (Phase 2.1).

## 2. Authorization (BOLA/IDOR)
- **Threat:** Player A accessing Player B's private data.
- **Mitigation:** `requireOwnership` returns 404 (not 403) to prevent existence leaks (Phase 2.3).

## 3. Match Results & Economy
- **Threat:** Fabricated results, replay attacks.
- **Mitigation (replay):** Idempotency keys + unique constraints (Phase 3.4).
- **Mitigation (fabrication):** In this milestone there is no public route to accept a match result; the canonical write path is reached only through `CanonicalResultService.acceptResult`, which is invoked by trusted internal code. When an HTTP layer is added, it must sit behind authenticated internal auth before this mitigation is complete.

## 4. Matchmaking & Tournaments
- **Threat:** Race conditions allowing a player into two matches.
- **Mitigation:** Atomic `findOneAndUpdate` claims with optimistic locking (Phase 7.2).

## 5. Abuse & Moderation
- **Threat:** Compromised admin accounts.
- **Mitigation:** Audit logging (Phase 8.2). High-risk routes re-verify account status (Phase 2.6).

## 6. Data Integrity
- **Threat:** Consumer failure causing data corruption.
- **Mitigation:** Transactional outbox (Phase 3.3), idempotency (Phase 3.4), dead-letter queues (Phase 4.5).

## 7. Accepted Risks
- No application-layer rate limiting (delegated to API gateway — not present in this milestone, so this is a documented gap for any future HTTP surface).
- No field-level encryption (data classification).
