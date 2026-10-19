import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { PlayerService } from "../../src/domain/players/player-service";
import "dotenv/config";

describe("PlayerService - Profile Update", () => {
  let client: MongoClient;
  let db: Db;
  let service: PlayerService;
  let playerId: string;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-profile-test");
    service = new PlayerService(db);
    
    // Create a dummy player to update
    // Fix: explicitly type the collection to expect a string _id
    await db.collection<{ _id: string } & Document>("players").insertOne({
      _id: "player_update_test",
      displayName: "OriginalName",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    playerId = "player_update_test";
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("updates displayName successfully", async () => {
    const updated = await service.updateProfile(playerId, { displayName: "NewName" });
    expect(updated.displayName).toBe("NewName");
  });

  it("rejects mass-assignment attempts without modifying the DB", async () => {
    const payload = {
      displayName: "Hacker",
      status: "admin",
      rating: 9999
    };

    await expect(service.updateProfile(playerId, payload)).rejects.toThrow(/INVALID_PAYLOAD/);

    // Verify the DB was NOT modified
    const player = await db.collection<{ _id: string } & Document>("players").findOne({ _id: playerId });
    expect(player!["displayName"]).toBe("NewName"); // Stays the same as the previous test
    expect(player!["status"]).toBe("active"); // Did not become admin
    expect(player!["rating"]).toBeUndefined(); // Was not inserted
  });
});