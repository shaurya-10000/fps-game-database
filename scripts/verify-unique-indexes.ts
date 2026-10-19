import { MongoClient, Document } from "mongodb";
import "dotenv/config";
import { logger } from "../src/infrastructure/logging/logger";

async function verifyUniqueIndexes() {
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI is missing");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("fps-game-database");

  logger.info("Starting unique and partial index verification...");

  // 1. playerIdentities: Unique on { provider, providerId }
  const identitiesCol = db.collection<{ _id: string } & Document>("playerIdentities");
  
  // Clean slate BEFORE we start
  await identitiesCol.deleteMany({ _id: { $in: ["id_1", "id_2"] } });
  await identitiesCol.dropIndex("provider_1_providerId_1").catch(() => {});
  await identitiesCol.createIndex({ provider: 1, providerId: 1 }, { unique: true });
  
  await identitiesCol.insertOne({
    _id: "id_1", playerId: "p1", provider: "steam", providerId: "steam_123", createdAt: new Date()
  });

  try {
    await identitiesCol.insertOne({
      _id: "id_2", playerId: "p2", provider: "steam", providerId: "steam_123", createdAt: new Date()
    });
    logger.error("❌ FAIL: Duplicate identity was accepted.");
    process.exit(1);
  } catch (err) {
    if ((err as Document)["code"] === 11000) {
      logger.info("✅ PASS: Duplicate identity rejected with E11000.");
    } else {
      logger.error("❌ FAIL: Unexpected error", { err: String(err) });
      process.exit(1);
    }
  }

  // 2. matchParticipants: Unique on { matchId, playerId }
  const participantsCol = db.collection<{ _id: string } & Document>("matchParticipants");
  
  // Clean slate BEFORE we start
  await participantsCol.deleteMany({ _id: { $in: ["mp_1", "mp_2"] } });
  await participantsCol.dropIndex("matchId_1_playerId_1").catch(() => {});
  await participantsCol.createIndex({ matchId: 1, playerId: 1 }, { unique: true });

  await participantsCol.insertOne({
    _id: "mp_1", matchId: "m1", playerId: "p1", score: 10, createdAt: new Date()
  });

  try {
    await participantsCol.insertOne({
      _id: "mp_2", matchId: "m1", playerId: "p1", score: 20, createdAt: new Date()
    });
    logger.error("❌ FAIL: Duplicate participant was accepted.");
    process.exit(1);
  } catch (err) {
    if ((err as Document)["code"] === 11000) {
      logger.info("✅ PASS: Duplicate participant rejected with E11000.");
    } else {
      logger.error("❌ FAIL: Unexpected error", { err: String(err) });
      process.exit(1);
    }
  }

  // Final cleanup
  await identitiesCol.deleteMany({ _id: { $in: ["id_1", "id_2"] } });
  await participantsCol.deleteMany({ _id: { $in: ["mp_1", "mp_2"] } });

  await client.close();
  logger.info("🎉 All unique index verifications passed.");
}

verifyUniqueIndexes().catch(console.error);