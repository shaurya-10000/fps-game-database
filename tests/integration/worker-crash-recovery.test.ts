import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { OutboxRelay } from "../../src/infrastructure/outbox/relay";
import { RatingProcessor, RatingEvent } from "../../src/domain/matches/rating-processor";
import "dotenv/config";

describe("Outbox Relay - 4.9 Worker Crash Recovery", () => {
  let client: MongoClient;
  let db: Db;
  let relay: OutboxRelay;
  let processor: RatingProcessor;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-crash-recovery-test");
    relay = new OutboxRelay(db, "worker-A");
    processor = new RatingProcessor(db);
  });

  afterEach(async () => {
    await db.collection("competitiveRatings").deleteMany({});
    await db.collection("ratingEvents").deleteMany({});
    await db.collection("outboxDeliveries").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("recovers a delivery when the worker crashes after claim but before effect", async () => {
    await db.collection<{ _id: string } & Document>("outboxDeliveries").insertOne({
      _id: "del_crash",
      eventId: "evt_crash_1",
      consumer: "rating",
      status: "pending",
      attempts: 0,
      availableAt: new Date(),
      createdAt: new Date()
    });

    const claimed = await relay.claimDelivery();
    expect(claimed).not.toBeNull();
    expect(claimed!.leaseOwner).toBe("worker-A");

    await db.collection<{ _id: string } & Document>("outboxDeliveries").updateOne(
      { _id: "del_crash" },
      { $set: { leaseUntil: new Date(Date.now() - 60000) } }
    );

    const reclaimed = await relay.claimDelivery();
    expect(reclaimed).not.toBeNull();
    expect(reclaimed!._id).toBe("del_crash");

    const event: RatingEvent = {
      _id: "evt_crash_1",
      playerId: "player_crash_1",
      sequence: 1,
      ratingDelta: 30,
      matchId: "match_crash_1",
      createdAt: new Date()
    };

    const result = await processor.processEvent("del_crash", event, "worker-A");
    expect(result).toBe("applied");

    // Fix: explicitly type each collection
    const projection = await db.collection<{ _id: string } & Document>("competitiveRatings").findOne({ _id: "player_crash_1" });
    expect(projection!["rating"]).toBe(1030);

    const eventCount = await db.collection<{ _id: string } & Document>("ratingEvents").countDocuments({ _id: "evt_crash_1" });
    expect(eventCount).toBe(1);

    const delivery = await db.collection<{ _id: string } & Document>("outboxDeliveries").findOne({ _id: "del_crash" });
    expect(delivery!["status"]).toBe("completed");
  });
});
