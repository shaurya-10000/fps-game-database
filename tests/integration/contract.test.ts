import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { CanonicalResultService, MatchResultPayload } from "../../src/domain/matches/canonical-service";
import { matchAcceptanceResponseSchema } from "../../src/domain/matches/contracts";
import "dotenv/config";

describe("CanonicalResultService - 3.7 Contract Tests", () => {
  let client: MongoClient;
  let db: Db;
  let service: CanonicalResultService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-contract-test");
    service = new CanonicalResultService(db);
    await db.collection("idempotencyRecords").createIndex({ scope: 1, key: 1 }, { unique: true });
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("matches the defined OpenAPI/Contract schema", async () => {
    const matchId = `match_${crypto.randomUUID()}`;
    await db.collection<{ _id: string } & Document>("matches").insertOne({
      _id: matchId,
      status: "in_progress",
      contentVersion: "v1",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const payload: MatchResultPayload = {
      matchId,
      participants: [{ playerId: "p1", team: "terrorist", score: 100 }]
    };

    const response = await service.acceptResult(payload, "contract-key-1", "contract-fp-1");

    // Validate the response against the strict schema
    const parseResult = matchAcceptanceResponseSchema.safeParse(response);
    
    if (!parseResult.success) {
      console.error(parseResult.error.format());
    }
    
    expect(parseResult.success).toBe(true);
  });

  it("fails if the response shape diverges from the contract", () => {
    const badResponse = {
      matchId: "123",
      status: "completed",
      accepted: true,
      extraField: "I should not be here"
    };

    const parseResult = matchAcceptanceResponseSchema.safeParse(badResponse);
    expect(parseResult.success).toBe(false);
  });
});
