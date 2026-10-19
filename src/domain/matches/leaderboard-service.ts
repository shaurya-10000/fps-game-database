import { Db, Document } from "mongodb";

export interface LeaderboardEntry {
  _id: string;
  rating: number;
  playerId: string;
}

export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  nextCursor?: string | undefined; // Fix: explicitly allow undefined
}

export class LeaderboardService {
  constructor(private db: Db) {}

  async getLeaderboardPage(limit: number, cursor?: string): Promise<LeaderboardPage> {
    const col = this.db.collection<{ _id: string } & Document>("competitiveRatings");
    
    let query: Document = {};
    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
      query = {
        $or: [
          { rating: { $lt: decoded.rating } },
          { rating: decoded.rating, _id: { $gt: decoded.playerId } }
        ]
      };
    }

    const entries = await col
      .find(query)
      .sort({ rating: -1, _id: 1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = entries.length > limit;
    const pageEntries = hasMore ? entries.slice(0, limit) : entries;
    
    const last = pageEntries[pageEntries.length - 1];
    // Fix: strict index signature access
    const nextCursor = hasMore && last
      ? Buffer.from(JSON.stringify({ rating: last["rating"], playerId: last._id })).toString("base64")
      : undefined;

    return {
      entries: pageEntries.map((e) => ({
        _id: e._id,
        rating: e["rating"] as number,
        playerId: e._id
      })),
      nextCursor
    };
  }
}
