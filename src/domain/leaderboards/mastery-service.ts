import { Db } from "mongodb";

export interface PlayerMastery {
  _id: string;
  playerId: string;
  type: "weapon" | "character";
  entityId: string;
  xp: number;
  level: number;
  updatedAt: Date;
}

export class MasteryService {
  constructor(private db: Db) {}

  async ensureIndexes(): Promise<void> {
    const col = this.db.collection("playerMastery");
    await col.createIndex({ playerId: 1, type: 1 });
    await col.createIndex({ type: 1, entityId: 1, xp: -1 }); 
  }

  async awardMasteryXp(playerId: string, type: "weapon" | "character", entityId: string, xpGained: number): Promise<void> {
    const id = `${playerId}_${type}_${entityId}`;
    const col = this.db.collection<PlayerMastery>("playerMastery");

    const existing = await col.findOne({ _id: id });
    const newXp = (existing?.xp || 0) + xpGained;
    const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;

    await col.updateOne(
      { _id: id },
      {
        $set: {
          playerId,
          type,
          entityId,
          xp: newXp,
          level: newLevel,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
}
