import { MongoClient, Document } from "mongodb";
import "dotenv/config";
import { logger } from "../src/infrastructure/logging/logger";

async function replayDeadLetter() {
  const uri = process.env["MONGODB_URI"];
  if (!uri) throw new Error("MONGODB_URI is missing");

  const deliveryId = process.argv[2];
  if (!deliveryId) {
    console.error("Usage: ts-node scripts/replay-dead-letter.ts <deliveryId>");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("fps-game-database");
  
  const col = db.collection<{ _id: string } & Document>("outboxDeliveries");
  
  const result = await col.updateOne(
    { _id: deliveryId, status: "dead_letter" },
    { 
      $set: { 
        status: "pending", 
        availableAt: new Date(),
        attempts: 0, 
        replayedAt: new Date() 
      },
      $unset: { lastError: "", failedAt: "" }
    }
  );

  if (result.modifiedCount === 0) {
    logger.warn(`No dead-lettered delivery found with ID ${deliveryId}`);
  } else {
    logger.info(`Successfully replayed delivery ${deliveryId}`);
  }

  await client.close();
}

replayDeadLetter().catch(console.error);
