import { Db, Document } from "mongodb";
import { logger } from "../../infrastructure/logging/logger";

export interface Season {
  _id: string;
  name: string;
  status: "draft" | "active" | "closed";
  startedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
}

export class SeasonService {
  constructor(private db: Db) {}

  async createSeason(name: string): Promise<Season> {
    const col = this.db.collection<Season>("seasons");
    const season: Season = {
      _id: `season_${crypto.randomUUID()}`,
      name,
      status: "draft",
      createdAt: new Date()
    };
    await col.insertOne(season);
    return season;
  }

  async activateSeason(seasonId: string): Promise<void> {
    const col = this.db.collection<Season>("seasons");
    
    const activeCount = await col.countDocuments({ status: "active" });
    if (activeCount > 0) {
      throw new Error("ANOTHER_SEASON_IS_ACTIVE");
    }

    const result = await col.updateOne(
      { _id: seasonId, status: "draft" },
      { $set: { status: "active", startedAt: new Date() } }
    );
    
    if (result.modifiedCount === 0) {
      throw new Error("SEASON_NOT_FOUND_OR_NOT_DRAFT");
    }
    
    logger.info("Season activated", { seasonId });
  }

  async closeSeason(seasonId: string): Promise<void> {
    const col = this.db.collection<Season>("seasons");
    const result = await col.updateOne(
      { _id: seasonId, status: "active" },
      { $set: { status: "closed", closedAt: new Date() } }
    );
    
    if (result.modifiedCount === 0) {
      throw new Error("SEASON_NOT_FOUND_OR_NOT_ACTIVE");
    }
    logger.info("Season closed", { seasonId });
  }

  async createMatchInSeason(seasonId: string, matchId: string): Promise<void> {
    const seasonsCol = this.db.collection<Season>("seasons");
    const season = await seasonsCol.findOne({ _id: seasonId });
    
    if (!season || season.status !== "active") {
      throw new Error("CANNOT_CREATE_MATCH_IN_NON_ACTIVE_SEASON");
    }

    // Fix: explicitly type the matches collection
    await this.db.collection<{ _id: string } & Document>("matches").updateOne(
      { _id: matchId },
      { $set: { seasonId } }
    );
  }
}
