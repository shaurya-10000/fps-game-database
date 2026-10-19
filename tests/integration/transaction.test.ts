import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoClient } from "mongodb";
import "dotenv/config";

describe("MongoDB Transactions", () => {
  let client: MongoClient;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) {
      throw new Error("MONGODB_URI is missing in .env");
    }
    client = new MongoClient(uri);
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
  });

  it("commits a multi-document transaction successfully", async () => {
    // Changed to match your preferred database name
    const db = client.db("fps-game-database");
    const col1 = db.collection<{ _id: string; value: number }>("tx_test_1");
    const col2 = db.collection<{ _id: string; value: number }>("tx_test_2");

    // Cleanup first
    await col1.deleteMany({});
    await col2.deleteMany({});

    const session = client.startSession();
    
    try {
      await session.withTransaction(async () => {
        await col1.insertOne({ _id: "doc1", value: 1 }, { session });
        await col2.insertOne({ _id: "doc2", value: 2 }, { session });
      });
    } finally {
      await session.endSession();
    }

    const count1 = await col1.countDocuments();
    const count2 = await col2.countDocuments();
    
    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });
});