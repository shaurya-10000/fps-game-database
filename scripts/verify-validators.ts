import { MongoClient, Document } from "mongodb";
import "dotenv/config";
import { collectionValidators } from "../src/infrastructure/mongodb/validators/schemas";
import { logger } from "../src/infrastructure/logging/logger";

async function verifyValidators() {
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI is missing");

  const client = new MongoClient(uri);
  await client.connect();
  
  const db = client.db("fps-game-database");
  
  for (const [collectionName, validator] of Object.entries(collectionValidators)) {
    // 1. Apply the validator
    await db.createCollection(collectionName, { validator }).catch(() => {
      return db.command({
        collMod: collectionName,
        validator,
        validationLevel: "strict",
        validationAction: "error"
      });
    });

    const col = db.collection<{ _id: string } & Document>(collectionName);

    // 2. Try to insert an INVALID document
    try {
      if (collectionName === "players") {
        await col.insertOne({ _id: "bad1", displayName: "x" }); // Missing required fields
      } else if (collectionName === "playerIdentities") {
        await col.insertOne({ _id: "bad1", playerId: "p1" }); // Missing required provider fields
      } else if (collectionName === "matches") {
        await col.insertOne({ _id: "bad1", status: "invalid_status", contentVersion: 1, createdAt: new Date() });
      }
      
      console.error(`❌ FAIL: ${collectionName} accepted invalid document.`);
      process.exit(1);
    } catch {
      logger.info(`✅ ${collectionName} correctly rejected invalid document.`);
    }

    // 3. Try to insert a VALID document
    try {
      if (collectionName === "players") {
        await col.insertOne({
          _id: "valid1",
          displayName: "PlayerOne",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } else if (collectionName === "playerIdentities") {
        await col.insertOne({
          _id: "valid1",
          playerId: "p1",
          provider: "steam",
          providerId: "12345",
          createdAt: new Date()
        });
      } else if (collectionName === "matches") {
        await col.insertOne({
          _id: "valid1",
          status: "created",
          contentVersion: 1,
          createdAt: new Date()
        });
      }
      
      logger.info(`✅ ${collectionName} accepted valid document.`);
      await col.deleteOne({ _id: "valid1" }); // Cleanup
    } catch (err) {
      console.error(`❌ FAIL: ${collectionName} rejected a valid document.`, err);
      process.exit(1);
    }
  }

  await client.close();
  logger.info("🎉 All validators verified successfully.");
}

verifyValidators().catch(console.error);