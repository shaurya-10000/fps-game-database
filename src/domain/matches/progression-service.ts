import { Db, Document } from "mongodb";

export interface ProgressionEvent {
  _id: string;
  playerId: string;
  xpDelta: number;
  sourceEventId: string;
  createdAt: Date;
}

export interface ProgressionProfile {
  _id: string;
  totalXp: number;
  level: number;
  updatedAt: Date;
}

export class ProgressionService {
  constructor(private db: Db) {}

  async awardXp(
    playerId: string,
    xpDelta: number,
    sourceEventId: string
  ): Promise<"awarded" | "duplicate"> {
    const eventsCol = this.db.collection<ProgressionEvent>("progressionEvents");
    const profilesCol = this.db.collection<ProgressionProfile>("progressionProfiles");

    // Idempotency: check if this source event was already processed
    const existing = await eventsCol.findOne({ playerId, sourceEventId });
    if (existing) {
      return "duplicate";
    }

    // Append to ledger
    await eventsCol.insertOne({
      _id: `xp_${crypto.randomUUID()}`,
      playerId,
      xpDelta,
      sourceEventId,
      createdAt: new Date()
    });

    // Update projection
    const result = await profilesCol.findOneAndUpdate(
      { _id: playerId },
      { 
        $inc: { totalXp: xpDelta },
        $set: { updatedAt: new Date() },
        $setOnInsert: { _id: playerId, level: 1 }
      },
      { upsert: true, returnDocument: "after" }
    );

    // Simple level formula: level = floor(sqrt(totalXp / 100)) + 1
    const totalXp = result!.totalXp;
    const level = Math.floor(Math.sqrt(totalXp / 100)) + 1;
    
    await profilesCol.updateOne({ _id: playerId }, { $set: { level } });

    return "awarded";
  }
}
