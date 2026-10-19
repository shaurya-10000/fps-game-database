import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";

export interface IdempotencyRecord {
  _id: string;
  scope: string;     // e.g., "match-result"
  key: string;       // The client-provided idempotency key
  fingerprint: string; // Hash of the request payload
  response: Record<string, unknown>; // The original success response
  createdAt: Date;
}

export class IdempotencyService {
  constructor(private db: Db) {}

  /**
   * Retrieves an existing idempotency record.
   * If found, compares the fingerprint. If fingerprints differ, throws 409.
   */
  async checkIdempotency(scope: string, key: string, fingerprint: string): Promise<Record<string, unknown> | null> {
    const col = this.db.collection<IdempotencyRecord>("idempotencyRecords");
    
    const existing = await col.findOne({ scope, key });
    if (!existing) return null;

    if (existing.fingerprint !== fingerprint) {
      logger.warn("Idempotency key reuse with different payload", { scope, key });
      throw new Error("IDEMPOTENCY_KEY_REUSED");
    }

    return existing.response;
  }

  /**
   * Records a successful request so it can be replayed.
   * Must be called INSIDE the same transaction as the actual business logic.
   */
  async saveIdempotencyRecord(
    scope: string,
    key: string,
    fingerprint: string,
    response: Record<string, unknown>,
    session: import("mongodb").ClientSession
  ): Promise<void> {
    const col = this.db.collection<IdempotencyRecord>("idempotencyRecords");
    
    await col.insertOne(
      {
        _id: `idem_${crypto.randomUUID()}`,
        scope,
        key,
        fingerprint,
        response,
        createdAt: new Date(),
      },
      { session }
    );
  }
}