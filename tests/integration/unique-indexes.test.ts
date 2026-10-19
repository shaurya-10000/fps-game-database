import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import "dotenv/config";

describe("Unique Index Constraints", () => {
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-unique-test");
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("rejects duplicate playerIdentities", async () => {
    const col = db.collection<{ _id: string } & Document>("playerIdentities");
    await col.createIndex({ provider: 1, providerId: 1 }, { unique: true });

    await col.insertOne({ _id: "1", playerId: "p1", provider: "steam", providerId: "123", createdAt: new Date() });
    
    await expect(
      col.insertOne({ _id: "2", playerId: "p2", provider: "steam", providerId: "123", createdAt: new Date() })
    ).rejects.toThrow(/E11000/);
  });

  it("rejects duplicate matchParticipants", async () => {
    const col = db.collection<{ _id: string } & Document>("matchParticipants");
    await col.createIndex({ matchId: 1, playerId: 1 }, { unique: true });

    await col.insertOne({ _id: "1", matchId: "m1", playerId: "p1", createdAt: new Date() });
    
    await expect(
      col.insertOne({ _id: "2", matchId: "m1", playerId: "p1", createdAt: new Date() })
    ).rejects.toThrow(/E11000/);
  });
});