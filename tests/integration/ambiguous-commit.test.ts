import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { CanonicalResultService, MatchResultPayload } from "../../src/domain/matches/canonical-service";
import { setFailurePoint, clearFailurePoint } from "../../src/infrastructure/failure-injection";
import "dotenv/config";

describe("CanonicalResultService - 3.5 Ambiguous Commit", () => {
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
    db = client.db("fps-game-ambiguous-test");
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

  it("resolves ambiguous commit to exactly one canonical result on retry", async () => {
    const id = `match_${crypto.randomUUID()}`;
    await db.collection<{ _id: string } & Document>("matches").insertOne({
      _id: id,
      status: "in_progress",
      contentVersion: "v1",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    matchId = id;

    const key = "ambiguous-key-1";
    const fingerprint = "ambiguous-fingerprint-1";

    // 1. Arm the ambiguous failure
    setFailurePoint("commit-succeeded-acknowledgment-lost");

    // 2. First request throws, but the DB transaction actually committed
    await expect(service.acceptResult({ ...payload, matchId }, key, fingerprint))
      .rejects.toThrow("Injected Failure: commit-succeeded-acknowledgment-lost");

    // 3. Client retries with the EXACT same key and payload
    // It should return the cached response without creating duplicate records
    const retryResponse = await service.acceptResult({ ...payload, matchId }, key, fingerprint);
    expect(retryResponse["matchId"]).toBe(matchId);
    expect(retryResponse["accepted"]).toBe(true);

    // 4. Verify exactly one set of canonical records exists
    const match = await db.collection<{ _id: string } & Document>("matches").findOne({ _id: matchId });
    expect(match!["status"]).toBe("completed");
    expect(await db.collection("matchParticipants").countDocuments({ matchId })).toBe(2);
    expect(await db.collection("outboxEvents").countDocuments({ matchId })).toBe(1);
    expect(await db.collection("outboxDeliveries").countDocuments()).toBe(3);
  });
});

