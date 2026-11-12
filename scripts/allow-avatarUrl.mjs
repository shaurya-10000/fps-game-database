// One-off migration: allow avatarUrl on the players collection
// Run with: node scripts/allow-avatarUrl.mjs
import "dotenv/config";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not set");
  process.exit(1);
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db("fps-game-database");

// Inspect the existing validator
const info = await db.command({ listCollections: 1, filter: { name: "players" } });
const current = info.cursor.firstBatch[0]?.options?.validator;
console.log("Current validator:", JSON.stringify(current, null, 2));

if (!current) {
  console.error("! No validator exists on players. Aborting (nothing to change).");
  await client.close();
  process.exit(1);
}

// Merge avatarUrl into the existing validator properties
const updated = { ...current };
if (!updated.$jsonSchema) updated.$jsonSchema = {};
if (!updated.$jsonSchema.properties) updated.$jsonSchema.properties = {};

updated.$jsonSchema.properties.avatarUrl = {
  bsonType: ["string", "null"],
  description: "Base64 data URL for the player's avatar (max 140KB)",
  maxLength: 140000,
};

await db.command({
  collMod: "players",
  validator: updated,
  validationLevel: "strict",
  validationAction: "error",
});

console.log("\n✓ Validator updated. avatarUrl is now allowed on players.\n");

// Verify by re-fetching
const after = await db.command({ listCollections: 1, filter: { name: "players" } });
console.log("New avatarUrl rule:", JSON.stringify(after.cursor.firstBatch[0]?.options?.validator?.$jsonSchema?.properties?.avatarUrl, null, 2));

await client.close();
