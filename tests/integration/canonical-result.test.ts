import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { CanonicalResultService, MatchResultPayload } from "../../src/domain/matches/canonical-service";
import { setFailurePoint, clearFailurePoint } from "../../src/infrastructure/failure-injection";
import "dotenv/config";

describe("CanonicalResultService - 3.3 Transaction Rollback", () => {
  let client: MongoClient;
  let db: Db;
  let service: CanonicalResultService;
  let matchId: string;
  
  const payload: MatchResultPayload = {
    matchId: "",
    gameModeId: "team_deathmatch", participants: [
      { playerId: "p1", team: "terrorist", score: 100, kills: 10, deaths: 5, damage: 500, survivalTimeSeconds: 0 },
      { playerId: "p2", team: "counter-terrorist", score: 50, kills: 10, deaths: 5, damage: 500, survivalTimeSeconds: 0 }
    ]
  };

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-canonical-test");
    service = new CanonicalResultService(db);
    await db.collection("idempotencyRecords").createIndex({ scope: 1, key: 1 }, { unique: true });
  });

  afterEach(async () => {
    clearFailurePoint();
    await db.collection("outboxDeliveries").deleteMany({});
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

  it("commits successfully when no failure is injected", async () => {
    matchId = await setupMatch();
    await service.acceptResult({ ...payload, matchId }, "test-key-1", "fingerprint-1");

    const match = await db.collection<{ _id: string } & Document>("matches").findOne({ _id: matchId });
    expect(match!["status"]).toBe("completed");
    expect(await db.collection("matchParticipants").countDocuments({ matchId })).toBe(2);
    expect(await db.collection("outboxEvents").countDocuments({ matchId })).toBe(1);
    expect(await db.collection("outboxDeliveries").countDocuments()).toBe(3);
  });

  it("rolls back EVERYTHING if a failure is injected before commit", async () => {
    matchId = await setupMatch();
    setFailurePoint("before-transaction-commit");

    await expect(service.acceptResult({ ...payload, matchId }, "test-key-2", "fingerprint-2"))
      .rejects.toThrow("Injected Failure: before-transaction-commit");

    const match = await db.collection<{ _id: string } & Document>("matches").findOne({ _id: matchId });
    expect(match!["status"]).toBe("in_progress");
    expect(await db.collection("matchParticipants").countDocuments({ matchId })).toBe(0);
    expect(await db.collection("outboxEvents").countDocuments({ matchId })).toBe(0);
    expect(await db.collection("outboxDeliveries").countDocuments()).toBe(0);
  });
});

