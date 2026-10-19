import { MongoClient } from "mongodb";
import "dotenv/config";
import { logger } from "../src/infrastructure/logging/logger";

interface IndexSpec {
  collection: string;
  index: Record<string, 1 | -1>;
  name: string;
  unique?: boolean;
}

// This must match docs/architecture/index-inventory.md exactly.
// Any index created by the app (migrations, services, tests) must be listed
// here, otherwise the "rogue index" check below will fail.
const inventory: IndexSpec[] = [
  // players
  { collection: "players", index: { displayName: 1 }, name: "displayName_1", unique: true },

  // playerIdentities
  { collection: "playerIdentities", index: { provider: 1, providerId: 1 }, name: "provider_1_providerId_1", unique: true },
  { collection: "playerIdentities", index: { playerId: 1 }, name: "playerId_1" },

  // matches
  { collection: "matches", index: { status: 1, createdAt: -1 }, name: "status_1_createdAt_-1" },

  // matchParticipants
  { collection: "matchParticipants", index: { matchId: 1, playerId: 1 }, name: "matchId_1_playerId_1", unique: true },
  { collection: "matchParticipants", index: { playerId: 1, createdAt: -1 }, name: "playerId_1_createdAt_-1" },

  // idempotencyRecords
  { collection: "idempotencyRecords", index: { scope: 1, key: 1 }, name: "scope_1_key_1", unique: true },

  // outboxDeliveries — claim + monitoring
  { collection: "outboxDeliveries", index: { status: 1, availableAt: 1 }, name: "status_1_availableAt_1" },
  { collection: "outboxDeliveries", index: { status: 1, leaseUntil: 1 }, name: "status_1_leaseUntil_1" },
  { collection: "outboxDeliveries", index: { createdAt: 1 }, name: "createdAt_1" },

  // competitiveRatings — leaderboard sort
  { collection: "competitiveRatings", index: { rating: -1, _id: 1 }, name: "rating_-1__id_1" },

  // inventoryItems
  { collection: "inventoryItems", index: { playerId: 1, definitionId: 1, sourceEventId: 1 }, name: "playerId_1_definitionId_1_sourceEventId_1", unique: true },

  // progressionEvents
  { collection: "progressionEvents", index: { playerId: 1, sourceEventId: 1 }, name: "playerId_1_sourceEventId_1", unique: true },

  // friendships
  { collection: "friendships", index: { fromPlayerId: 1, toPlayerId: 1 }, name: "from_1_to_1", unique: true },
  { collection: "friendships", index: { fromPlayerId: 1, status: 1 }, name: "from_1_status_1" },
  { collection: "friendships", index: { toPlayerId: 1, status: 1 }, name: "to_1_status_1" },

  // blocks
  { collection: "blocks", index: { blockerId: 1, blockedId: 1 }, name: "blocker_1_blocked_1", unique: true },
];

async function verifyIndexes() {
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI is missing");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("fps-game-database");

  for (const spec of inventory) {
    const col = db.collection(spec.collection);
    await col.createIndex(spec.index, { name: spec.name, background: true, unique: spec.unique === true });
    logger.info(`Ensured index exists: ${spec.collection}.${spec.name}`);

    const indexes = await col.indexes();
    const exists = indexes.some((idx) => idx.name === spec.name);
    if (!exists) {
      console.error(`FAIL: Index ${spec.name} on ${spec.collection} was not created.`);
      process.exit(1);
    }
  }

  // Rogue-index check: any index on any collection that is not in inventory fails.
  // System collections are skipped.
  const collections = await db.listCollections().toArray();
  for (const colInfo of collections) {
    if (colInfo.name.startsWith("system.")) continue;

    const col = db.collection(colInfo.name);
    const indexes = await col.indexes();

    for (const idx of indexes) {
      if (idx.name === "_id_") continue;
      const isInInventory = inventory.some(
        (spec) => spec.collection === colInfo.name && spec.name === idx.name
      );
      if (!isInInventory) {
        console.error(`FAIL: Rogue index found: ${colInfo.name}.${idx.name}. Update index-inventory.md or drop the index.`);
        process.exit(1);
      }
    }
  }

  await client.close();
  logger.info("All indexes verified successfully and match inventory.");
}

verifyIndexes().catch((err) => {
  console.error(err);
  process.exit(1);
});
