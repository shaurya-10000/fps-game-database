import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { CanonicalResultService, MatchResultPayload } from "../../src/domain/matches/canonical-service";
import { ProjectionService } from "../../src/domain/matches/projection-service";
import "dotenv/config";

describe("ProjectionService - 3.6 Projection Status", () => {
  let client: MongoClient;
  let db: Db;
  let service: CanonicalResultService;
  let projectionService: ProjectionService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-projection-test");
    service = new CanonicalResultService(db);
    projectionService = new ProjectionService(db);
    await db.collection("idempotencyRecords").createIndex({ scope: 1, key: 1 }, { unique: true });
  });

  afterEach(async () => {
    await db.collection("outboxDeliveries").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("returns pending initially, and completed after consumer runs", async () => {
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

    await service.acceptResult(payload, "proj-key-1", "proj-fp-1");

    const initialStatus = await projectionService.getProjectionStatus(matchId);
    expect(initialStatus.rating).toBe("pending");

    // Fix: explicitly type the findOne result to expect a string _id
    const event = await db.collection<{ _id: string } & Document>("outboxEvents").findOne({ matchId });
    await projectionService.markDeliveryAsCompleted(event!["_id"], "rating");

    const updatedStatus = await projectionService.getProjectionStatus(matchId);
    expect(updatedStatus.rating).toBe("completed");
    expect(updatedStatus.progression).toBe("pending");
  });
});
