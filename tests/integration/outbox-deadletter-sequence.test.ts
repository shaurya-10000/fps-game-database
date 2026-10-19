import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { OutboxRelay } from "../../src/infrastructure/outbox/relay";
import { RatingSequenceService } from "../../src/domain/matches/rating-sequence-service";
import { clearFailurePoint } from "../../src/infrastructure/failure-injection";
import "dotenv/config";

describe("Outbox Relay - Phase 4.5 & 4.6", () => {
  let client: MongoClient;
  let db: Db;
  let relay: OutboxRelay;
  let sequenceService: RatingSequenceService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-dl-test");
    relay = new OutboxRelay(db, "worker-A");
    sequenceService = new RatingSequenceService(db);
  });

  afterEach(async () => {
    clearFailurePoint();
    await db.collection("outboxDeliveries").deleteMany({});
    await db.collection("ratingSequences").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("4.5: moves to dead_letter after max attempts", async () => {
    await db.collection<{ _id: string } & Document>("outboxDeliveries").insertOne({
      _id: "del_dl",
      eventId: "evt_1",
      consumer: "rating",
      status: "pending",
      attempts: 3, // Already at max
      availableAt: new Date(),
      createdAt: new Date()
    });

    const delivery = await relay.claimDelivery();
    const result = await relay.failDelivery(delivery!._id, "permanent failure");
    
    expect(result).toBe("dead_letter");
    
    // Fix: explicitly type the collection
    const doc = await db.collection<{ _id: string } & Document>("outboxDeliveries").findOne({ _id: "del_dl" });
    expect(doc!["status"]).toBe("dead_letter");
  });

  it("4.6: allocates unique per-player sequences in a transaction", async () => {
    const session = client.startSession();
    const playerId = "player_seq_1";
    
    try {
      await session.withTransaction(async () => {
        const seq1 = await sequenceService.allocateSequence(playerId, session);
        expect(seq1).toBe(1);
        
        const seq2 = await sequenceService.allocateSequence(playerId, session);
        expect(seq2).toBe(2);
      });
    } finally {
      await session.endSession();
    }

    // Fix: explicitly type the collection
    const doc = await db.collection<{ _id: string } & Document>("ratingSequences").findOne({ _id: playerId });
    expect(doc!["nextSequence"]).toBe(2);
  });
});
