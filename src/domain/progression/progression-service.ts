import { Db } from "mongodb";
import { XpEngine } from "./xp-engine";
import { ParticipantStats } from "../matches/canonical-service";
import { logger } from "../../infrastructure/logging/logger";

export interface PlayerProfile {
  _id: string; // playerId
  totalXp: number;
  level: number;
  updatedAt: Date;
}

export class ProgressionService {
  constructor(private db: Db) {}

  async awardMatchXp(stats: ParticipantStats, gameModeId: string): Promise<void> {
    const session = this.db.client.startSession();
    const col = this.db.collection<PlayerProfile>("progressionProfiles");

    try {
      await session.withTransaction(async () => {
        const xpGained = XpEngine.calculateMatchXp(stats, gameModeId);
        
        let profile = await col.findOne({ _id: stats.playerId }, { session });
        
        if (!profile) {
          profile = { _id: stats.playerId, totalXp: 0, level: 1, updatedAt: new Date() };
        }

        let newTotalXp = profile.totalXp + xpGained;
        let newLevel = profile.level;
        let xpForNext = XpEngine.getXpRequiredForNextLevel(newLevel);

        // Level-up loop (handles multiple level ups in one match)
        while (newTotalXp >= xpForNext) {
          newTotalXp -= xpForNext;
          newLevel++;
          xpForNext = XpEngine.getXpRequiredForNextLevel(newLevel);
        }

        await col.updateOne(
          { _id: stats.playerId },
          {
            $set: {
              totalXp: newTotalXp, // Note: This is XP *within* the current level
              level: newLevel,
              updatedAt: new Date()
            }
          },
          { upsert: true, session }
        );

        logger.info("Progression updated", { 
          playerId: stats.playerId, 
          xpGained, 
          newLevel, 
          currentLevelXp: newTotalXp,
          xpForNext 
        });
      });
    } finally {
      await session.endSession();
    }
  }
}
