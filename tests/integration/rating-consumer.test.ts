import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { RatingConsumer } from "../../src/domain/matches/rating-consumer";
import "dotenv/config";

describe("RatingConsumer - Phase 4.7", () => {
  let client: MongoClient;
  let db: Db;
  let consumer: RatingConsumer;
  const playerId = "player_rating_test";

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-rating-consumer-test");
    consumer = new RatingConsumer(db);
  });

  afterEach(async () => {
    await db.collection("competitiveRatings").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("applies in-order events correctly", async () => {
    expect(await consumer.applyRatingEvent(playerId, 1, 20)).toBe("applied");
    expect(await consumer.applyRatingEvent(playerId, 2, 15)).toBe("applied");
    expect(await consumer.applyRatingEvent(playerId, 3, 10)).toBe("applied");

    const projection = await db.collection<{ _id: string } & Document>("competitiveRatings").findOne({ _id: playerId });
    expect(projection!["rating"]).toBe(1045); // 1000 + 20 + 15 + 10
    expect(projection!["lastAppliedSequence"]).toBe(3);
  });

  it("no-ops on duplicate events", async () => {
    await consumer.applyRatingEvent(playerId, 1, 20);
    expect(await consumer.applyRatingEvent(playerId, 1, 20)).toBe("duplicate");
    expect(await consumer.applyRatingEvent(playerId, 1, 999)).toBe("duplicate"); // Even with different delta, must ignore

    const projection = await db.collection<{ _id: string } & Document>("competitiveRatings").findOne({ _id: playerId });
    expect(projection!["rating"]).toBe(1020);
  });

  it("defers out-of-order events without skipping", async () => {
    await consumer.applyRatingEvent(playerId, 1, 20);
    
    // Sequence 3 arrives before 2
    expect(await consumer.applyRatingEvent(playerId, 3, 50)).toBe("deferred");
    
    // The projection should still be at sequence 1
    let projection = await db.collection<{ _id: string } & Document>("competitiveRatings").findOne({ _id: playerId });
    expect(projection!["lastAppliedSequence"]).toBe(1);
    
    // Now sequence 2 arrives
    expect(await consumer.applyRatingEvent(playerId, 2, 15)).toBe("applied");
    
    // Now retry sequence 3
    expect(await consumer.applyRatingEvent(playerId, 3, 50)).toBe("applied");
    
    projection = await db.collection<{ _id: string } & Document>("competitiveRatings").findOne({ _id: playerId });
    expect(projection!["rating"]).toBe(1085); // 1000 + 20 + 15 + 50
    expect(projection!["lastAppliedSequence"]).toBe(3);
  });
});
