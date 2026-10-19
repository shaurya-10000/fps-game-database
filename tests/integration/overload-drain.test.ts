import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { MongoClient, Db, Document } from "mongodb";
import { OutboxRelay } from "../../src/infrastructure/outbox/relay";
import "dotenv/config";

describe("Phase 9.3 - Overload Drain", () => {
  let client: MongoClient;
  let db: Db;
  let relays: OutboxRelay[];

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-overload-test");
    relays = [
      new OutboxRelay(db, "worker-1"),
      new OutboxRelay(db, "worker-2"),
      new OutboxRelay(db, "worker-3"),
      new OutboxRelay(db, "worker-4")
    ];
  });

  afterEach(async () => {
    await db.collection("outboxDeliveries").deleteMany({});
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("4 parallel relay workers drain backlog with no duplicates and no lost events", async () => {
    const BACKLOG_SIZE = 50;
    const start = Date.now();

    const docs: Document[] = [];
    for (let i = 0; i < BACKLOG_SIZE; i++) {
      docs.push({
        _id: `del_overload_${i}`,
        eventId: `evt_overload_${i}`,
        consumer: "rating",
        status: "pending",
        attempts: 0,
        availableAt: new Date(),
        createdAt: new Date()
      });
    }
    await db.collection("outboxDeliveries").insertMany(docs as any);

    // Track which worker claimed each delivery
    const claimsPerWorker: Record<string, Set<string>> = {
      "worker-1": new Set(),
      "worker-2": new Set(),
      "worker-3": new Set(),
      "worker-4": new Set()
    };

    const workerLoop = async (relay: OutboxRelay) => {
      while (true) {
        const delivery = await relay.claimDelivery();
        if (!delivery) return;

        // Verify no duplicate claim
        const workerId = (delivery as any).leaseOwner as string;
        if (!claimsPerWorker[workerId]) claimsPerWorker[workerId] = new Set();
        if (claimsPerWorker[workerId].has(delivery._id)) {
          throw new Error(`DUPLICATE CLAIM: ${delivery._id} by ${workerId}`);
        }
        claimsPerWorker[workerId].add(delivery._id);

        await relay.completeDelivery(delivery._id);
      }
    };

    // Run all 4 workers in parallel
    await Promise.all(relays.map(r => workerLoop(r)));

    const duration = Date.now() - start;

    // Verify all 50 deliveries completed, no duplicates
    const completed = await db.collection("outboxDeliveries").countDocuments({ status: "completed" });
    expect(completed).toBe(BACKLOG_SIZE);

    const totalClaims = Object.values(claimsPerWorker).reduce((sum, set) => sum + set.size, 0);
    expect(totalClaims).toBe(BACKLOG_SIZE);

    const pending = await db.collection("outboxDeliveries").countDocuments({ status: "pending" });
    expect(pending).toBe(0);

    // Drain under 60s
    expect(duration).toBeLessThan(60000);
  }, 120000);
});
