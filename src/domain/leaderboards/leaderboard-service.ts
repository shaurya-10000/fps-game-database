import { Db } from "mongodb";
import { FriendshipService } from "../friends/friendship-service";

export interface LeaderboardEntry {
  _id: string; 
  score: number;
  tier: string;
  rank: number;
}

export class LeaderboardService {
  private friendshipService: FriendshipService;

  constructor(private db: Db) {
    this.friendshipService = new FriendshipService(db);
  }

  async getGlobalLeaderboard(limit = 50, offset = 0): Promise<LeaderboardEntry[]> {
    return this.db
      .collection("competitiveRatings")
      .find({})
      .sort({ rating: -1 })
      .skip(offset)
      .limit(limit)
      .toArray() as unknown as LeaderboardEntry[];
  }

  async getRegionalLeaderboard(region: string, limit = 50, offset = 0): Promise<LeaderboardEntry[]> {
    return this.db
      .collection("competitiveRatings")
      .find({ region }) 
      .sort({ rating: -1 })
      .skip(offset)
      .limit(limit)
      .toArray() as unknown as LeaderboardEntry[];
  }

  async getFriendsLeaderboard(playerId: string, limit = 50): Promise<LeaderboardEntry[]> {
    const friends = await this.friendshipService.listFriends(playerId);
    const friendIds = friends.map(f => f.toPlayerId);
    friendIds.push(playerId);

    return this.db
      .collection<{ _id: string }>("competitiveRatings")
      .find({ _id: { $in: friendIds } })
      .sort({ rating: -1 })
      .limit(limit)
      .toArray() as unknown as LeaderboardEntry[];
  }

  async getWeaponLeaderboard(weaponId: string, limit = 50): Promise<LeaderboardEntry[]> {
    return this.db
      .collection("playerMastery")
      .find({ type: "weapon", entityId: weaponId })
      .sort({ xp: -1 })
      .limit(limit)
      .toArray() as unknown as LeaderboardEntry[];
  }

  async getCharacterLeaderboard(characterId: string, limit = 50): Promise<LeaderboardEntry[]> {
    return this.db
      .collection("playerMastery")
      .find({ type: "character", entityId: characterId })
      .sort({ xp: -1 })
      .limit(limit)
      .toArray() as unknown as LeaderboardEntry[];
  }
}
