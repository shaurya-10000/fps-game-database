import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { RatingProcessor, RatingEvent } from "../../src/domain/matches/rating-processor";
import { setFailurePoint, clearFailurePoint } from "../../src/infrastructure/failure-injection";
import "dotenv/config";

describe("RatingProcessor - 4.8 Atomicity", () => {
  let client: MongoClient;
  let db: Db;
  let processor: RatingProcessor;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-rating-atomic-test");
    processor = new RatingProcessor(db);
  });

  afterEach(async () => {
    clearFailurePoint();
    await db.collection("competitiveRatings").deleteMany({});
    await db.collection("ratingEvents").deleteMany({});
    await db.collection("outboxDeliveries").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  async function setupDelivery(id: string): Promise<void> {
    await db.collection<{ _id: string } & Document>("outboxDeliveries").insertOne({
      _id: id,
      eventId: "evt_atomic_1",
      consumer: "rating",
      status: "processing",
      leaseOwner: "worker-A",
      leaseUntil: new Date(Date.now() + 30000),
      attempts: 1,
      availableAt: new Date(),
      createdAt: new Date()
    });
  }

  it("rolls back everything if failure is injected after projection update", async () => {
    await setupDelivery("del_atomic_1");
    const event: RatingEvent = {
      _id: "evt_atomic_1",
      playerId: "player_atomic_1",
      sequence: 1,
      ratingDelta: 25,
      matchId: "match_1",
      createdAt: new Date()
    };

    setFailurePoint("before-projection-commit");

    await expect(processor.processEvent("del_atomic_1", event, "worker-A"))
      .rejects.toThrow("Injected Failure: before-projection-commit");

    // Fix: explicitly type each collection
    const projection = await db.collection<{ _id: string } & Document>("competitiveRatings").findOne({ _id: "player_atomic_1" });
    expect(projection).toBeNull();

    const ratingEvent = await db.collection<{ _id: string } & Document>("ratingEvents").findOne({ _id: "evt_atomic_1" });
    expect(ratingEvent).toBeNull();

    const delivery = await db.collection<{ _id: string } & Document>("outboxDeliveries").findOne({ _id: "del_atomic_1" });
    expect(delivery!["status"]).toBe("processing");
  });
});
