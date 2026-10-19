import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";

export interface RatingProjection {
  _id: string; // playerId
  rating: number;
  lastAppliedSequence: number;
  updatedAt: Date;
}

export class RatingConsumer {
  constructor(private db: Db) {}

  async applyRatingEvent(
    playerId: string, 
    sequence: number, 
    ratingDelta: number
  ): Promise<"applied" | "duplicate" | "deferred"> {
    const projectionsCol = this.db.collection<RatingProjection>("competitiveRatings");
    const projection = await projectionsCol.findOne({ _id: playerId });

    if (!projection) {
      // If this is the first event, it must be sequence 1
      if (sequence !== 1) {
        logger.warn("Gap detected: first event must be sequence 1", { playerId, sequence });
        return "deferred";
      }
      await projectionsCol.insertOne({
        _id: playerId,
        rating: 1000 + ratingDelta,
        lastAppliedSequence: 1,
        updatedAt: new Date()
      });
      return "applied";
    }

    // Duplicate detection
    if (sequence <= projection.lastAppliedSequence) {
      logger.info("Duplicate event detected, skipping", { playerId, sequence, lastApplied: projection.lastAppliedSequence });
      return "duplicate";
    }

    // Gap detection
    if (sequence > projection.lastAppliedSequence + 1) {
      logger.warn("Gap detected, deferring event", { playerId, sequence, lastApplied: projection.lastAppliedSequence });
      return "deferred";
    }

    // Apply the event atomically
    await projectionsCol.updateOne(
      { _id: playerId, lastAppliedSequence: projection.lastAppliedSequence },
      { 
        $inc: { rating: ratingDelta },
        $set: { lastAppliedSequence: sequence, updatedAt: new Date() }
      }
    );

    return "applied";
  }
}
