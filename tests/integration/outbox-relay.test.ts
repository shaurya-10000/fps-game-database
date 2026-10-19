import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { OutboxRelay } from "../../src/infrastructure/outbox/relay";
import { setFailurePoint, clearFailurePoint } from "../../src/infrastructure/failure-injection";
import "dotenv/config";

describe("Outbox Relay - Phase 4", () => {
  let client: MongoClient;
  let db: Db;
  let relay: OutboxRelay;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-relay-test");
    relay = new OutboxRelay(db, "worker-1");
  });

  afterEach(async () => {
    clearFailurePoint();
    await db.collection("outboxDeliveries").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("claims and processes a delivery successfully", async () => {
    await db.collection<{ _id: string } & Document>("outboxDeliveries").insertOne({
      _id: "del_1",
      eventId: "evt_1",
      consumer: "rating",
      status: "pending",
      attempts: 0,
      availableAt: new Date(),
      createdAt: new Date()
    });

    const delivery = await relay.claimDelivery();
    expect(delivery).not.toBeNull();
    expect(delivery!._id).toBe("del_1");
    expect(delivery!.status).toBe("processing");

    const success = await relay.completeDelivery(delivery!._id);
    expect(success).toBe(true);

    const updated = await db.collection<{ _id: string } & Document>("outboxDeliveries").findOne({ _id: "del_1" });
    expect(updated!["status"]).toBe("completed");
  });
});
