import { Db, Document, ClientSession } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";
import { triggerFailurePoint } from "../../infrastructure/failure-injection";
import { IdempotencyService } from "./idempotency-service";

export interface MatchResultPayload {
  matchId: string;
  participants: {
    playerId: string;
    team: "terrorist" | "counter-terrorist";
    score: number;
  }[];
}

export class CanonicalResultService {
  private idempotencyService: IdempotencyService;

  constructor(private db: Db) {
    this.idempotencyService = new IdempotencyService(db);
  }

  async acceptResult(
    payload: MatchResultPayload, 
    idempotencyKey: string, 
    fingerprint: string
  ): Promise<Record<string, unknown>> {
    
    const cachedResponse = await this.idempotencyService.checkIdempotency(
      "match-result", 
      idempotencyKey, 
      fingerprint
    );
    
    if (cachedResponse) {
      logger.info("Idempotent replay detected. Returning original response.", { idempotencyKey });
      return cachedResponse;
    }

    const session = this.db.client.startSession();
    let responsePayload: Record<string, unknown> = {};

    try {
      await session.withTransaction(async () => {
        const matchesCol = this.db.collection<{ _id: string } & Document>("matches");
        const participantsCol = this.db.collection<{ _id: string } & Document>("matchParticipants");
        const outboxCol = this.db.collection<{ _id: string } & Document>("outboxEvents");
        const deliveriesCol = this.db.collection<{ _id: string } & Document>("outboxDeliveries");

        const matchUpdate = await matchesCol.updateOne(
          { _id: payload.matchId },
          { $set: { status: "completed", updatedAt: new Date() } },
          { session }
        );

        if (matchUpdate.matchedCount === 0) {
          throw new Error("MATCH_NOT_FOUND");
        }

        const participantDocs = payload.participants.map((p) => ({
          _id: `mp_${crypto.randomUUID()}`,
          matchId: payload.matchId,
          playerId: p.playerId,
          team: p.team,
          score: p.score,
          createdAt: new Date(),
        }));

        await participantsCol.insertMany(participantDocs, { session });

        const eventId = `evt_${crypto.randomUUID()}`;
        await outboxCol.insertOne(
          {
            _id: eventId,
            type: "MATCH_COMPLETED",
            matchId: payload.matchId,
            payload: payload,
            createdAt: new Date(),
          },
          { session }
        );

        const consumers = ["rating", "progression", "statistics"];
        const deliveryDocs = consumers.map((consumer) => ({
          _id: `del_${crypto.randomUUID()}`,
          eventId: eventId,
          consumer: consumer,
          status: "pending",
          availableAt: new Date(),
          createdAt: new Date(),
        }));

        await deliveriesCol.insertMany(deliveryDocs, { session });

        responsePayload = { matchId: payload.matchId, status: "completed", accepted: true };

        await this.idempotencyService.saveIdempotencyRecord(
          "match-result",
          idempotencyKey,
          fingerprint,
          responsePayload,
          session
        );

        triggerFailurePoint("before-transaction-commit");
      });

      logger.info("Successfully committed canonical match result", { matchId: payload.matchId });
      
      // Simulate the acknowledgment loss AFTER the commit
      triggerFailurePoint("commit-succeeded-acknowledgment-lost");
      
      return responsePayload;
      
    } catch (err) {
      if ((err as Document)["code"] === 11000) {
        logger.info("Concurrent idempotency race detected. Returning existing result.");
        const existing = await this.idempotencyService.checkIdempotency("match-result", idempotencyKey, fingerprint);
        if (existing) return existing;
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
