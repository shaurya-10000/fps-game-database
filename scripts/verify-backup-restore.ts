import { MongoClient, Document } from "mongodb";
import "dotenv/config";
import { logger } from "../src/infrastructure/logging/logger";

async function verifyBackupRestore() {
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI is missing");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("fps-game-database");

  const collections = ["players", "matches", "matchParticipants", "outboxEvents", "outboxDeliveries", "competitiveRatings"];
  
  for (const name of collections) {
    const count = await db.collection(name).countDocuments();
    logger.info(`Collection ${name}: ${count} documents`);
  }

  const indexChecks = [
    { collection: "playerIdentities", index: "provider_1_providerId_1" },
    { collection: "matchParticipants", index: "matchId_1_playerId_1" },
  ];

  for (const check of indexChecks) {
    const indexes = await db.collection(check.collection).indexes();
    const found = indexes.some(i => i.name === check.index);
    if (!found) throw new Error(`Missing index ${check.index} on ${check.collection}`);
    logger.info(`Index ${check.index} exists on ${check.collection}`);
  }

  const orphanParticipants = await db.collection("matchParticipants").aggregate([
    { $lookup: { from: "matches", localField: "matchId", foreignField: "_id", as: "match" } },
    { $match: { "match.0": { $exists: false } } },
    { $limit: 1 }
  ]).toArray();

  if (orphanParticipants.length > 0) {
    logger.error("Orphaned participants found (referential integrity breach)");
  } else {
    logger.info("No orphaned participants (referential integrity intact)");
  }

  logger.info("Backup restore verification complete");
  await client.close();
}

verifyBackupRestore().catch(console.error);
