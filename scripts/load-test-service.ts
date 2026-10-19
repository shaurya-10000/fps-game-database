import { MongoClient, Document } from "mongodb";
import { CanonicalResultService } from "../src/domain/matches/canonical-service";
import "dotenv/config";

async function runServiceLoadTest() {
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI is missing");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("fps-game-loadtest-db");
  const service = new CanonicalResultService(db);

  console.log("\n=== Service-level Load Test (direct, no HTTP) ===");
  console.log("Target: MongoDB Atlas (real network latency, not local)");
  console.log("Warming up...\n");

  // Warmup
  for (let i = 0; i < 3; i++) {
    const warmId = `match_warm_${crypto.randomUUID()}`;
    // Fix: explicit _id type
    await db.collection<{ _id: string } & Document>("matches").insertOne({
      _id: warmId,
      status: "in_progress",
      contentVersion: "v1",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await service.acceptResult(
      { matchId: warmId, participants: [{ playerId: "p1", team: "terrorist", score: 100 }] },
      `warm-key-${i}`,
      `warm-fp-${i}`
    );
  }

  const results: number[] = [];
  const ITERATIONS = 20;

  for (let i = 0; i < ITERATIONS; i++) {
    const matchId = `match_lt_${crypto.randomUUID()}`;
    // Fix: explicit _id type
    await db.collection<{ _id: string } & Document>("matches").insertOne({
      _id: matchId,
      status: "in_progress",
      contentVersion: "v1",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const start = Date.now();
    await service.acceptResult(
      { matchId, participants: [{ playerId: "p1", team: "terrorist", score: 100 }] },
      `lt-key-${i}`,
      `lt-fp-${i}`
    );
    results.push(Date.now() - start);
  }

  results.sort((a, b) => a - b);
  const p50 = results[Math.floor(results.length * 0.50)]!;
  const p95 = results[Math.floor(results.length * 0.95)]!;
  const p99 = results[Math.floor(results.length * 0.99)]!;
  const mean = results.reduce((a, b) => a + b, 0) / results.length;

  console.log(`Iterations: ${ITERATIONS}`);
  console.log(`Mean:   ${mean.toFixed(2)}ms`);
  console.log(`p50:    ${p50}ms`);
  console.log(`p95:    ${p95}ms`);
  console.log(`p99:    ${p99}ms`);
  console.log(`Min:    ${results[0]}ms`);
  console.log(`Max:    ${results[results.length - 1]}ms`);
  console.log("\nNote: These numbers include network round-trips to MongoDB Atlas.");
  console.log("Local-datacenter deployments will be significantly faster.\n");

  // Cleanup test db
  await db.dropDatabase();
  await client.close();
}

runServiceLoadTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
