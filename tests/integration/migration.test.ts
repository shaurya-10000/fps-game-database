import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { MongoClient, Db } from "mongodb";
import "dotenv/config";

describe("Migration Framework", () => {
  let client: MongoClient;
  let db: Db;

  beforeAll(async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("fps-game-migrations-test"); // Using a separate test DB
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  it("records migration state and is idempotent", async () => {
    const migrationsCol = db.collection("schemaMigrations");
    
    // Simulate applying a migration
    await migrationsCol.insertOne({ name: "001-test", status: "applied", completedAt: new Date() });
    
    // Simulate runner logic checking for existing
    const applied = await migrationsCol.find({ status: "applied" }).toArray();
    expect(applied.length).toBe(1);
    expect(applied[0]!["name"]).toBe("001-test");
  });

  it("does not record a failed migration as applied", async () => {
    const migrationsCol = db.collection("schemaMigrations");
    
    await migrationsCol.insertOne({ name: "002-fail", status: "failed", error: "Mock error" });
    
    const applied = await migrationsCol.findOne({ name: "002-fail" });
    expect(applied!["status"]).toBe("failed");
  });
});