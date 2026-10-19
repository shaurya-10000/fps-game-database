import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { LeaderboardService } from "../../src/domain/matches/leaderboard-service";
import { InventoryService } from "../../src/domain/matches/inventory-service";
import { ProgressionService } from "../../src/domain/matches/progression-service";
import "dotenv/config";

describe("Phase 6 - Statistics & Economy", () => {
  let client: MongoClient;
  let db: Db;
  let leaderboard: LeaderboardService;
  let inventory: InventoryService;
  let progression: ProgressionService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-phase6-test");
    leaderboard = new LeaderboardService(db);
    inventory = new InventoryService(db);
    progression = new ProgressionService(db);
    await inventory.ensureUniqueConstraint();
    await db.collection("progressionEvents").createIndex({ playerId: 1, sourceEventId: 1 }, { unique: true });
  });

  afterEach(async () => {
    await db.collection("competitiveRatings").deleteMany({});
    await db.collection("inventoryItems").deleteMany({});
    await db.collection("progressionEvents").deleteMany({});
    await db.collection("progressionProfiles").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describe("6.3 Leaderboard Cursor Pagination", () => {
    it("paginates deterministically with no gaps or duplicates", async () => {
      for (let i = 0; i < 25; i++) {
        await db.collection<{ _id: string } & Document>("competitiveRatings").insertOne({
          _id: `player_${String(i).padStart(3, "0")}`,
          rating: 2000 - i,
          lastAppliedSequence: 1,
          updatedAt: new Date()
        });
      }

      const page1 = await leaderboard.getLeaderboardPage(10);
      expect(page1.entries.length).toBe(10);
      expect(page1.entries[0]!._id).toBe("player_000");
      expect(page1.nextCursor).toBeDefined();

      const page2 = await leaderboard.getLeaderboardPage(10, page1.nextCursor);
      expect(page2.entries.length).toBe(10);
      expect(page2.entries[0]!._id).toBe("player_010");

      const page3 = await leaderboard.getLeaderboardPage(10, page2.nextCursor);
      expect(page3.entries.length).toBe(5);
      expect(page3.nextCursor).toBeUndefined();
    });
  });

  describe("6.4 Inventory Grant Idempotency", () => {
    it("only grants once per source event", async () => {
      const r1 = await inventory.grantItem("player_1", "skin_gold_ak", "match_evt_1");
      expect(r1).toBe("granted");

      const r2 = await inventory.grantItem("player_1", "skin_gold_ak", "match_evt_1");
      expect(r2).toBe("duplicate");

      const count = await db.collection("inventoryItems").countDocuments({ playerId: "player_1" });
      expect(count).toBe(1);
    });
  });

  describe("6.5 Progression Ledger", () => {
    it("does not double-award XP for the same event", async () => {
      const r1 = await progression.awardXp("player_xp", 100, "evt_xp_1");
      expect(r1).toBe("awarded");

      const r2 = await progression.awardXp("player_xp", 100, "evt_xp_1");
      expect(r2).toBe("duplicate");

      // Fix: explicitly type the collection
      const profile = await db.collection<{ _id: string } & Document>("progressionProfiles").findOne({ _id: "player_xp" });
      expect(profile!["totalXp"]).toBe(100);

      await progression.awardXp("player_xp", 200, "evt_xp_2");
      const updated = await db.collection<{ _id: string } & Document>("progressionProfiles").findOne({ _id: "player_xp" });
      expect(updated!["totalXp"]).toBe(300);
    });
  });
});
