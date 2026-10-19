import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { PlayerService } from "../../src/domain/players/player-service";
import { Principal } from "../../src/infrastructure/auth/identity-provider";
import "dotenv/config";

describe("PlayerService - Concurrent First Login", () => {
  let client: MongoClient;
  let db: Db;
  let service: PlayerService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-player-test");
    service = new PlayerService(db);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("creates exactly one player and one identity from 10 parallel requests", async () => {
    const principal: Principal = {
      providerId: "auth0|user_999",
      provider: "https://auth0.com/",
    };

    // Fire 10 requests concurrently
    const requests = Array.from({ length: 10 }).map(() => service.resolvePlayer(principal));
    const results = await Promise.all(requests);

    // Assert all requests returned the same player
    const firstPlayerId = results[0]!._id;
    for (const player of results) {
      expect(player._id).toBe(firstPlayerId);
    }

    // Assert the DB state
    // Fix: explicitly type the collection to expect a string _id
    const playersCount = await db.collection<{ _id: string }>("players").countDocuments({ 
      _id: firstPlayerId 
    });
    
    const identitiesCount = await db.collection<Document>("playerIdentities").countDocuments({
      provider: principal.provider,
      providerId: principal.providerId,
    });

    expect(playersCount).toBe(1);
    expect(identitiesCount).toBe(1);
  });
});