import { Db } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";
import { triggerFailurePoint } from "../../infrastructure/failure-injection";
import { IdempotencyService } from "./idempotency-service";

export interface ParticipantStats {
  playerId: string;
  team: "terrorist" | "counter-terrorist" | "solo";
  score: number;
  kills: number;
  deaths: number;
  damage: number;
  survivalTimeSeconds: number;
}

export interface MatchResultPayload {
  matchId: string;
  gameModeId: string;
  participants: ParticipantStats[];
}

interface OutboxEventDocument {
  _id: string;
  type: string;
  matchId: string;
  payload: MatchResultPayload;
  createdAt: Date;
}

export class CanonicalResultService {
  private idempotencyService: IdempotencyService;

  constructor(private db: Db) {
    this.idempotencyService = new IdempotencyService(db);
  }

  async acceptResult(payload: MatchResultPayload, idempotencyKey: string, fingerprint: string): Promise<Record<string, unknown>> {
    const cachedResponse = await this.idempotencyService.checkIdempotency("match-result", idempotencyKey, fingerprint);
    if (cachedResponse) return cachedResponse;

    const session = this.db.client.startSession();
    let responsePayload = {};

    try {
      await session.withTransaction(async () => {
        const matchesCol = this.db.collection<{ _id: string }>("matches");
        const participantsCol = this.db.collection<{ _id: string }>("matchParticipants");
        const outboxCol = this.db.collection<OutboxEventDocument>("outboxEvents");
        const deliveriesCol = this.db.collection<{ _id: string }>("outboxDeliveries");

        const matchUpdate = await matchesCol.updateOne(
          { _id: payload.matchId },
          { $set: { status: "completed", gameModeId: payload.gameModeId, updatedAt: new Date() } },
          { session }
        );

        if (matchUpdate.matchedCount === 0) throw new Error("MATCH_NOT_FOUND");

        const participantDocs = payload.participants.map((p) => ({
          _id: `mp_${crypto.randomUUID()}`,
          matchId: payload.matchId,
          playerId: p.playerId,
          team: p.team,
          score: p.score,
          kills: p.kills,
          deaths: p.deaths,
          damage: p.damage,
          survivalTimeSeconds: p.survivalTimeSeconds,
          createdAt: new Date(),
        }));

        await participantsCol.insertMany(participantDocs, { session });

        const eventId = `evt_${crypto.randomUUID()}`;
        await outboxCol.insertOne({
          _id: eventId,
          type: "MATCH_COMPLETED",
          matchId: payload.matchId,
          payload: payload,
          createdAt: new Date(),
        }, { session });

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
        await this.idempotencyService.saveIdempotencyRecord("match-result", idempotencyKey, fingerprint, responsePayload, session);

        triggerFailurePoint("before-transaction-commit");
      });

      logger.info("Successfully committed canonical match result", { matchId: payload.matchId });
      triggerFailurePoint("commit-succeeded-acknowledgment-lost");
      return responsePayload;

    } catch (err) {
      if (err && typeof err === "object" && (err as { code?: number }).code === 11000) {
        const existing = await this.idempotencyService.checkIdempotency("match-result", idempotencyKey, fingerprint);
        if (existing) return existing;
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }
}
