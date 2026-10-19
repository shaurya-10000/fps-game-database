import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";
import { RatingProjection } from "./rating-consumer";

export interface RatingCorrection {
  _id: string;
  playerId: string;
  originalEventId: string;
  correctionDelta: number;
  reason: string;
  operator: string;
  createdAt: Date;
}

export class RatingCorrectionService {
  constructor(private db: Db) {}

  async applyCorrection(
    playerId: string,
    originalEventId: string,
    correctionDelta: number,
    reason: string,
    operator: string
  ): Promise<void> {
    const correctionsCol = this.db.collection<RatingCorrection>("ratingCorrections");
    const projectionsCol = this.db.collection<RatingProjection>("competitiveRatings");

    // Fix: explicitly type the collection
    const originalEvent = await this.db
      .collection<{ _id: string } & Document>("ratingEvents")
      .findOne({ _id: originalEventId });

    if (!originalEvent) {
      throw new Error("ORIGINAL_EVENT_NOT_FOUND");
    }

    await correctionsCol.insertOne({
      _id: `corr_${crypto.randomUUID()}`,
      playerId,
      originalEventId,
      correctionDelta,
      reason,
      operator,
      createdAt: new Date()
    });

    await projectionsCol.updateOne(
      { _id: playerId },
      { $inc: { rating: correctionDelta }, $set: { updatedAt: new Date() } }
    );

    logger.info("Rating correction applied", { playerId, originalEventId, correctionDelta, operator });
  }
}
