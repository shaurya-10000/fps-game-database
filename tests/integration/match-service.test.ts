import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { MatchService } from "../../src/domain/matches/match-service";
import "dotenv/config";

describe("MatchService - Catalog & Lifecycle", () => {
  let client: MongoClient;
  let db: Db;
  let service: MatchService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-match-test");
    service = new MatchService(db);

    // Seed a content version
    await db.collection<{ _id: string } & Document>("contentVersions").insertOne({
      _id: "v1",
      maps: ["Terminal"],
      weapons: ["RK-7"],
      characters: ["Ember"],
      gameModes: ["Ranked"],
      createdAt: new Date()
    });
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  describe("3.1 Versioned Content Catalog", () => {
    it("pins a match to a content version and resolves it even if catalog updates", async () => {
      // 1. Create match on v1
      const match = await service.createMatch("v1");
      expect(match.contentVersion).toBe("v1");

      // 2. Update catalog to v2 (simulate new content)
      // Fix: explicitly type the collection to expect a string _id
      await db.collection<{ _id: string } & Document>("contentVersions").insertOne({
        _id: "v2",
        maps: ["Frostline", "Ashfall"],
        weapons: ["VK-4", "LR-9"],
        characters: ["Drift"],
        gameModes: ["Ranked", "Casual"],
        createdAt: new Date()
      });

      // 3. Re-read match, ensure it still resolves to v1 definitions
      const resolved = await service.getMatchWithResolvedContent(match._id);
      expect(resolved.match.contentVersion).toBe("v1");
      expect(resolved.content._id).toBe("v1");
      expect(resolved.content.maps).toEqual(["Terminal"]);
    });
  });

  describe("3.2 Match Lifecycle State Machine", () => {
    it("enforces legal transitions", async () => {
      const match = await service.createMatch("v1");
      
      const inProgress = await service.transitionMatch(match._id, "in_progress");
      expect(inProgress.status).toBe("in_progress");

      const completed = await service.transitionMatch(match._id, "completed");
      expect(completed.status).toBe("completed");
    });

    it("throws on illegal transitions", async () => {
      const match = await service.createMatch("v1");
      
      // Cannot go from created -> completed directly
      await expect(service.transitionMatch(match._id, "completed"))
        .rejects.toThrow("ILLEGAL_TRANSITION");
        
      // Cannot go from created -> created
      await expect(service.transitionMatch(match._id, "created"))
        .rejects.toThrow("ILLEGAL_TRANSITION");
    });
  });
});