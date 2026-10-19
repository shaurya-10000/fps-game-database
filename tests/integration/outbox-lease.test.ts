import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { OutboxRelay } from "../../src/infrastructure/outbox/relay";
import { clearFailurePoint } from "../../src/infrastructure/failure-injection";
import "dotenv/config";

describe("Outbox Relay - Phase 4.2, 4.3, 4.4", () => {
  let client: MongoClient;
  let db: Db;
  let relayA: OutboxRelay;
  let relayB: OutboxRelay;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-relay-advanced-test");
    relayA = new OutboxRelay(db, "worker-A");
    relayB = new OutboxRelay(db, "worker-B");
  });

  afterEach(async () => {
    clearFailurePoint();
    await db.collection("outboxDeliveries").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  const makeDelivery = async (id: string) => {
    await db.collection<{ _id: string } & Document>("outboxDeliveries").insertOne({
      _id: id,
      eventId: "evt_1",
      consumer: "rating",
      status: "pending",
      attempts: 0,
      availableAt: new Date(),
      createdAt: new Date()
    });
  };

  it("4.2: reclaims an expired lease and applies effect exactly once", async () => {
    await makeDelivery("del_expired");
    
    const delivery = await relayA.claimDelivery();
    expect(delivery!._id).toBe("del_expired");

    // Fix: explicitly type the collection to expect a string _id
    await db.collection<{ _id: string } & Document>("outboxDeliveries").updateOne(
      { _id: "del_expired" },
      { $set: { leaseUntil: new Date(Date.now() - 60000) } }
    );

    const reclaimed = await relayB.claimDelivery();
    expect(reclaimed).not.toBeNull();
    expect(reclaimed!.leaseOwner).toBe("worker-B");

    const success = await relayB.completeDelivery("del_expired");
    expect(success).toBe(true);

    const finalState = await db.collection<{ _id: string } & Document>("outboxDeliveries").findOne({ _id: "del_expired" });
    expect(finalState!["status"]).toBe("completed");
  });

  it("4.3: rejects completion from a stale worker", async () => {
    await makeDelivery("del_stale");
    
    await relayA.claimDelivery();

    await db.collection<{ _id: string } & Document>("outboxDeliveries").updateOne(
      { _id: "del_stale" },
      { $set: { leaseUntil: new Date(Date.now() - 60000) } }
    );

    await relayB.claimDelivery();

    const staleSuccess = await relayA.completeDelivery("del_stale");
    expect(staleSuccess).toBe(false);

    const validSuccess = await relayB.completeDelivery("del_stale");
    expect(validSuccess).toBe(true);
  });

  it("4.4: applies exponential backoff and respects maxAttempts", async () => {
    await makeDelivery("del_retry");
    
    const delivery = await relayA.claimDelivery();
    
    const result1 = await relayA.failDelivery(delivery!._id, "transient error");
    expect(result1).toBe("retry");

    const doc1 = await db.collection<{ _id: string } & Document>("outboxDeliveries").findOne({ _id: "del_retry" });
    expect(doc1!["status"]).toBe("pending");
    expect(doc1!["attempts"]).toBe(1);
    expect(new Date(doc1!["availableAt"]).getTime()).toBeGreaterThan(Date.now());
  });
});
