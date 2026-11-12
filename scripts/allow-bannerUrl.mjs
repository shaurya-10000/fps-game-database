import "dotenv/config";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) { process.exit(1); }

const client = new MongoClient(uri);
await client.connect();
const db = client.db("fps-game-database");

const info = await db.command({ listCollections: 1, filter: { name: "players" } });
const current = info.cursor.firstBatch[0]?.options?.validator;

if (current && current.$jsonSchema && current.$jsonSchema.properties) {
  current.$jsonSchema.properties.bannerUrl = {
    bsonType: ["string", "null"],
    maxLength: 300000, // Banners can be slightly larger
  };
  
  await db.command({
    collMod: "players",
    validator: current,
  });
  console.log("✓ Added bannerUrl to players validator.");
} else {
  console.log("! No validator found.");
}
await client.close();
