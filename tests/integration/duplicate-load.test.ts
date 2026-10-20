import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { CanonicalResultService, MatchResultPayload } from "../../src/domain/matches/canonical-service";
import "dotenv/config";

describe("CanonicalResultService - 3.8 Duplicate Submission Under Load", () => {
  let client: MongoClient;
  let db: Db;
  let service: CanonicalResultService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-load-test");
    service = new CanonicalResultService(db);
    await db.collection("idempotencyRecords").createIndex({ scope: 1, key: 1 }, { unique: true });
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("handles 20 concurrent duplicate submissions flawlessly", async () => {
    const matchId = `match_load_${crypto.randomUUID()}`;
    await db.collection<{ _id: string } & Document>("matches").insertOne({
      _id: matchId,
      status: "in_progress",
      contentVersion: "v1",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const payload: MatchResultPayload = {
      matchId,
      gameModeId: "team_deathmatch", participants: [
        { playerId: "p1", team: "terrorist", score: 100, kills: 10, deaths: 5, damage: 500, survivalTimeSeconds: 0 },
        { playerId: "p2", team: "counter-terrorist", score: 50, kills: 10, deaths: 5, damage: 500, survivalTimeSeconds: 0 }
      ]
    };

    const idempotencyKey = `load-key-${crypto.randomUUID()}`;
    const fingerprint = `load-fp-${crypto.randomUUID()}`;

    // Create an array of promises with a tiny stagger (0-50ms) to avoid
    // exhausting the Atlas connection pool all in the same millisecond.
    const requests = Array.from({ length: 20 }).map((_, i) => {
      const delay = i * 5; // 0ms, 5ms, 10ms, etc.
      return new Promise<void>((resolve) => {
        setTimeout(resolve, delay);
      }).then(() => service.acceptResult(payload, idempotencyKey, fingerprint));
    });
    
    const results = await Promise.allSettled(requests);
    const fulfilled = results.filter(r => r.status === "fulfilled");
    const rejected = results.filter(r => r.status === "rejected");

    if (rejected.length > 0) {
      console.error("Rejected requests:", rejected.map(r => (r as PromiseRejectedResult).reason));
    }
    
    expect(fulfilled.length).toBe(20);

    const match = await db.collection<{ _id: string } & Document>("matches").findOne({ _id: matchId });
    expect(match!["status"]).toBe("completed");
    
    expect(await db.collection("matchParticipants").countDocuments({ matchId })).toBe(2);
    expect(await db.collection("outboxEvents").countDocuments({ matchId })).toBe(1);
    expect(await db.collection("outboxDeliveries").countDocuments()).toBe(3);
  }, 60000); // 60-second timeout
});

