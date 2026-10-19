import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { MatchService } from "../../src/domain/matches/match-service";
import "dotenv/config";

describe("Content catalog - seeded versions resolve correctly", () => {
  let client: MongoClient;
  let db: Db;
  let service: MatchService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-content-test");
    service = new MatchService(db);

    await db.collection<{ _id: string } & Document>("contentVersions").insertMany([
      {
        _id: "v1",
        maps: ["Terminal", "Frostline", "Ashfall"],
        weapons: ["RK-7", "VK-4", "LR-9"],
        characters: ["Ember", "Drift"],
        gameModes: ["Ranked", "Casual"],
        createdAt: new Date(),
      },
      {
        _id: "v2",
        maps: ["Terminal", "Frostline", "Ashfall", "Cinder"],
        weapons: ["RK-7", "VK-4", "LR-9", "AR-12"],
        characters: ["Ember", "Drift", "Rook"],
        createdAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("pins a match to v1 and keeps resolving v1 after catalog moves to v2", async () => {
    const match = await service.createMatch("v1");
    expect(match.contentVersion).toBe("v1");

    const resolved = await service.getMatchWithResolvedContent(match._id);
    expect(resolved.content.maps).toEqual(["Terminal", "Frostline", "Ashfall"]);
    expect(resolved.content.characters).toEqual(["Ember", "Drift"]);
    expect(resolved.content.gameModes).toEqual(["Ranked", "Casual"]);
  });

  it("pins a match to v2 and exposes the expanded catalog", async () => {
    const match = await service.createMatch("v2");
    const resolved = await service.getMatchWithResolvedContent(match._id);
    expect(resolved.content.maps).toContain("Cinder");
    expect(resolved.content.characters).toContain("Rook");
  });

  it("rejects match creation for an unknown content version", async () => {
    await expect(service.createMatch("v999")).rejects.toThrow(/CONTENT_VERSION_NOT_FOUND/);
  });
});