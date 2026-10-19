import { describe, expect, it } from "vitest";
import { MongoClient, Document } from "mongodb";
import "dotenv/config";

// Verifies the MongoDB driver's close() semantics.
// This is NOT an application graceful-shutdown test: this milestone has
// no long-lived process to shut down. If an HTTP server or worker loop
// is added later, this file should be joined by a real shutdown test that
// exercises SIGTERM -> drain in-flight work -> close Mongo -> exit.
describe("MongoDB client close semantics", () => {
  it("rejects commands after close()", async () => {
    const uri = process.env["MONGODB_URI"];
    if (!uri) throw new Error("MONGODB_URI is missing");

    const cleanupClient = new MongoClient(uri);
    await cleanupClient.connect();
    await cleanupClient.db("fps-game-shutdown-test").dropDatabase();
    await cleanupClient.close();

    const client = new MongoClient(uri);
    await client.connect();

    const db = client.db("fps-game-shutdown-test");
    const testId = `test_${crypto.randomUUID()}`;
    await db.collection<{ _id: string } & Document>("test").insertOne({ _id: testId });

    await client.close();

    await expect(client.db("admin").command({ ping: 1 })).rejects.toThrow();
  });
});