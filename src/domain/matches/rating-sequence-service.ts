import { Db, Document } from "mongodb";

export interface RatingSequence {
  _id: string; // playerId
  nextSequence: number;
}

export class RatingSequenceService {
  constructor(private db: Db) {}

  /**
   * Allocates the next sequence number for a player.
   * Must be called inside a transaction to ensure ordering.
   */
  async allocateSequence(playerId: string, session: import("mongodb").ClientSession): Promise<number> {
    const col = this.db.collection<RatingSequence>("ratingSequences");
    
    const result = await col.findOneAndUpdate(
      { _id: playerId },
      { 
        $inc: { nextSequence: 1 },
        $setOnInsert: { _id: playerId }
      },
      { upsert: true, returnDocument: "after", session }
    );

    if (!result || typeof result.nextSequence !== "number") {
      throw new Error("Failed to allocate sequence number");
    }

    return result.nextSequence;
  }
}
