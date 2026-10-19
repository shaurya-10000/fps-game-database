import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { CanonicalResultService, MatchResultPayload } from "../../src/domain/matches/canonical-service";
import "dotenv/config";

describe("CanonicalResultService - 3.4 Idempotency", () => {
  let client: MongoClient;
  let db: Db;
  let service: CanonicalResultService;
  let matchId: string;
  
  const payload: MatchResultPayload = {
    matchId: "", 
    participants: [
      { playerId: "p1", team: "terrorist", score: 100 },
      { playerId: "p2", team: "counter-terrorist", score: 50 }
    ]
  };

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-idempotency-test");
    service = new CanonicalResultService(db);
    await db.collection("idempotencyRecords").createIndex({ scope: 1, key: 1 }, { unique: true });
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  async function setupMatch(): Promise<string> {
    const id = `match_${crypto.randomUUID()}`;
    await db.collection<{ _id: string } & Document>("matches").insertOne({
      _id: id,
      status: "in_progress",
      contentVersion: "v1",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return id;
  }

  it("returns the original outcome for the same key + same payload", async () => {
    matchId = await setupMatch();
    const key = "idem-key-1";
    const fingerprint = "hash-abc";

    const res1 = await service.acceptResult({ ...payload, matchId }, key, fingerprint);
    expect(res1["accepted"]).toBe(true);

    const res2 = await service.acceptResult({ ...payload, matchId }, key, fingerprint);
    expect(res2).toEqual(res1);
    expect(await db.collection("matchParticipants").countDocuments({ matchId })).toBe(2);
  });

  it("throws 409 IDEMPOTENCY_KEY_REUSED for same key + different payload", async () => {
    matchId = await setupMatch();
    const key = "idem-key-2";
    await service.acceptResult({ ...payload, matchId }, key, "hash-original");

    await expect(
      service.acceptResult({ ...payload, matchId }, key, "hash-different")
    ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
  });

  it("handles concurrent submissions with the same key gracefully", async () => {
    matchId = await setupMatch();
    const key = "idem-key-3";
    const fingerprint = "hash-concurrent";

    const requests = Array.from({ length: 5 }).map(() => 
      service.acceptResult({ ...payload, matchId }, key, fingerprint)
    );
    const results = await Promise.allSettled(requests);
    expect(results.filter(r => r.status === "fulfilled").length).toBe(5);
    expect(await db.collection("matchParticipants").countDocuments({ matchId })).toBe(2);
  });
});
