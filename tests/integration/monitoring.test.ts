import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { MonitoringService } from "../../src/infrastructure/outbox/monitoring";
import "dotenv/config";

describe("MonitoringService - 4.10 Backpressure", () => {
  let client: MongoClient;
  let db: Db;
  let monitor: MonitoringService;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-monitor-test");
    monitor = new MonitoringService(db);
  });

  afterEach(async () => {
    await db.collection("outboxDeliveries").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("returns accurate queue metrics and fires alerts at thresholds", async () => {
    // Insert an old pending delivery (simulating a 2-minute backlog)
    await db.collection<{ _id: string } & Document>("outboxDeliveries").insertOne({
      _id: "del_old",
      eventId: "evt_1",
      consumer: "rating",
      status: "pending",
      attempts: 0,
      availableAt: new Date(),
      createdAt: new Date(Date.now() - 120000) // 2 minutes ago
    });

    const metrics = await monitor.getQueueMetrics();
    expect(metrics.pendingDepth).toBe(1);
    expect(metrics.oldestPendingAgeMs).toBeGreaterThan(60000);
    expect(metrics.deadLetterCount).toBe(0);
  });
});
